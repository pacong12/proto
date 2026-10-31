import { privateKeyToAccount } from 'viem/accounts';
import {
  EventPollerService,
  GraduationKeeperService,
  LimitOrderKeeperService,
  SourceVerifyKeeperService,
  V4BuybackKeeperService,
} from '../modules/tokens';
import { logger } from '../modules/observability';
import { createWalletClient, type Hex } from 'viem';
import { nativeWeiPerQuoteUnit } from '@goton/shared-types';
import { rpcTransport } from '../core';
import { repository, getTokenByAddressUseCase, chainRegistry, pollers } from './container';

/** Starts the pollers, keepers and maintenance timers (none in tests). */
export function startBackgroundJobs(): void {
  // Background event poller loop, one per supported chain.
  //
  // Strategy: adaptive polling with getLogs (HTTP-only RPC — no WebSocket available).
  //
  // Why getLogs polling and not watchContractEvent / WebSocket:
  //   - The chains' RPC endpoints expose HTTP only; no wss:// available.
  //   - viem watchContractEvent over HTTP is identical to getLogs polling internally,
  //     but lacks lastPolledBlock tracking (events lost on restart) and batching.
  //   - getLogs polling is reliable, idempotent, and retries the same block range
  //     on failure without permanently skipping data.
  //
  // Adaptive interval, per chain (NetworkConfig.indexerPollMs; INDEXER_POLL_ACTIVE_MS and
  // INDEXER_POLL_IDLE_MS override every chain):
  //   - Idle (no events found last cycle) → low RPC load
  //   - Active (events found last cycle) → trades show up within about a second on Robinhood
  //   - Catch-up: while the cursor is behind the head (after a restart or an RPC outage), poll
  //     again after POLL_INTERVAL_CATCH_UP_MS until it is current.
  //   - Block times are 250ms to 500ms. One cycle covers up to INDEXER_MAX_BLOCK_RANGE (2,000)
  //     blocks, far more than an idle interval produces.
  //
  // Chains are staggered by 30s to avoid simultaneous RPC bursts.
  // Recursive setTimeout (not setInterval) ensures a slow RPC cycle never overlaps the next.
  const POLL_INTERVAL_CATCH_UP_MS = 250; // behind the head → keep going
  const POLL_STAGGER_MS = 30_000;

  const intervalsOf = (chainId: number) => {
    const { indexerPollMs } = chainRegistry.getChainById(chainId).network;
    return {
      active: Number(process.env.INDEXER_POLL_ACTIVE_MS?.trim() || indexerPollMs.active),
      idle: Number(process.env.INDEXER_POLL_IDLE_MS?.trim() || indexerPollMs.idle),
    };
  };

  function schedulePoll(
    poller: EventPollerService,
    interval: { active: number; idle: number },
    delayMs: number,
  ): void {
    setTimeout(async () => {
      let next = delayMs;
      try {
        const found = await poller.pollEvents();
        // Tighten the interval while there is trading or a backlog; relax when idle.
        next = poller.isBehind
          ? POLL_INTERVAL_CATCH_UP_MS
          : found > 0
            ? interval.active
            : interval.idle;
      } catch {
        /* non-fatal — lastPolledBlock not advanced, next cycle retries */
      }
      schedulePoll(poller, interval, next);
    }, delayMs);
  }
  [...pollers.entries()].forEach(([chainId, poller], i) => {
    const interval = intervalsOf(chainId);
    schedulePoll(poller, interval, interval.idle + i * POLL_STAGGER_MS);
  });

  // ---------------------------------------------------------------------------
  // TWAP-guarded buyback keeper (AUD-HIGH-05 / TKT-06). Enabled with KEEPER_PRIVATE_KEY; the
  // contract enforces the price guard, so the key only pays gas and can never pick a bad price.
  // The same keeper pays the splitters' accrued protocol and liquidity shares to their vaults.
  // ---------------------------------------------------------------------------
  /** docker-compose passes unset variables as empty strings; treat those as unset. */
  const envOr = (name: string, fallback: string): string => process.env[name]?.trim() || fallback;

  // Limit, take-profit and stop-loss orders need a quick reaction; each cycle only simulates.
  const LIMIT_ORDER_KEEPER_INTERVAL_MS = Number(envOr('LIMIT_ORDER_KEEPER_INTERVAL_MS', '15000'));
  // A finished curve cannot trade until it graduates, so check often; each check is one read per curve.
  const GRADUATION_KEEPER_INTERVAL_MS = Number(envOr('GRADUATION_KEEPER_INTERVAL_MS', '30000'));
  const BUYBACK_KEEPER_INTERVAL_MS = Number(
    envOr('BUYBACK_KEEPER_INTERVAL_MS', String(10 * 60_000)),
  );

  function startBuybackKeepers(): void {
    const key = process.env.KEEPER_PRIVATE_KEY?.trim();
    if (!key || process.env.NODE_ENV === 'test') return;
    const account = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as Hex);
    for (const { network, client } of chainRegistry.getAllChains()) {
      const walletClient = createWalletClient({
        account,
        chain: client.chain,
        transport: rpcTransport(network, 30_000),
      });
      const keeper = new V4BuybackKeeperService(
        client,
        walletClient,
        repository,
        network,
        // The keeper never spends more on gas than it moves (KEEPER_MIN_QUOTE_<SLUG>).
        network.keeper.minQuote,
      );
      const limitKeeper = new LimitOrderKeeperService(
        client,
        walletClient,
        repository,
        network,
        nativeWeiPerQuoteUnit(network),
      );
      const graduationKeeper = new GraduationKeeperService(
        client,
        walletClient,
        repository,
        network,
      );
      // One wallet, several loops: run them one at a time so their transactions never share a nonce.
      let queue: Promise<unknown> = Promise.resolve();
      const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
        const run = queue.then(job, job);
        queue = run.catch(() => undefined);
        return run;
      };
      const tick = (): void => {
        setTimeout(async () => {
          try {
            const executed = (await exclusive(() => keeper.runOnce())).filter((r) => r.executed);
            if (executed.length > 0) {
              logger.info(
                `[BuybackKeeper:${network.name}] executed ${executed.length} transaction(s)`,
                {
                  actions: executed.map((r) => r.action ?? 'buyback'),
                },
              );
            }
          } catch (e) {
            logger.warn(`[BuybackKeeper:${network.name}] cycle failed`, {
              error: { name: (e as Error).name, message: (e as Error).message },
            });
          }
          tick();
        }, BUYBACK_KEEPER_INTERVAL_MS);
      };
      tick();
      const limitTick = (): void => {
        setTimeout(async () => {
          try {
            const filled = (await exclusive(() => limitKeeper.runOnce())).filter((r) => r.executed);
            if (filled.length > 0) {
              logger.info(`[LimitOrderKeeper:${network.name}] filled ${filled.length} order(s)`, {
                orders: filled.map((r) => r.key),
              });
            }
          } catch (e) {
            logger.warn(`[LimitOrderKeeper:${network.name}] cycle failed`, {
              error: { name: (e as Error).name, message: (e as Error).message },
            });
          }
          limitTick();
        }, LIMIT_ORDER_KEEPER_INTERVAL_MS);
      };
      limitTick();
      const graduationTick = (): void => {
        setTimeout(async () => {
          try {
            const done = (await exclusive(() => graduationKeeper.runOnce())).filter(
              (r) => r.executed,
            );
            if (done.length > 0) {
              logger.info(`[GraduationKeeper:${network.name}] graduated ${done.length} token(s)`, {
                tokens: done.map((r) => r.token),
              });
            }
          } catch (e) {
            logger.warn(`[GraduationKeeper:${network.name}] cycle failed`, {
              error: { name: (e as Error).name, message: (e as Error).message },
            });
          }
          graduationTick();
        }, GRADUATION_KEEPER_INTERVAL_MS);
      };
      graduationTick();
    }
  }
  startBuybackKeepers();

  // Source verification: publishes each launched token and curve on Sourcify, which the Blockscout
  // explorers import. Needs no key; SOURCE_VERIFY_INTERVAL_MS=0 disables it.
  const SOURCE_VERIFY_INTERVAL_MS = Number(envOr('SOURCE_VERIFY_INTERVAL_MS', String(5 * 60_000)));
  if (SOURCE_VERIFY_INTERVAL_MS > 0 && process.env.NODE_ENV !== 'test') {
    const sourceVerifier = new SourceVerifyKeeperService(
      repository,
      fetch,
      envOr('SOURCIFY_URL', 'https://sourcify.dev/server'),
    );
    const sourceVerifyTick = (): void => {
      setTimeout(async () => {
        try {
          const results = await sourceVerifier.runOnce();
          const submitted = results.filter((r) => r.status === 'submitted');
          const failed = results.filter((r) => r.status === 'failed');
          if (submitted.length > 0) {
            logger.info(`[SourceVerify] submitted ${submitted.length} contract(s) to Sourcify`, {
              contracts: submitted.map((r) => `${r.chainId}:${r.address}`),
            });
          }
          if (failed.length > 0) {
            logger.warn(`[SourceVerify] ${failed.length} contract(s) not verified`, {
              contracts: failed.map((r) => `${r.chainId}:${r.address} ${r.reason ?? ''}`),
            });
          }
        } catch (e) {
          logger.warn('[SourceVerify] cycle failed', {
            error: { name: (e as Error).name, message: (e as Error).message },
          });
        }
        sourceVerifyTick();
      }, SOURCE_VERIFY_INTERVAL_MS);
    };
    sourceVerifyTick();
  }

  // Market data refresh: list endpoints read stored rows, which otherwise change only on a trade or
  // a token page visit. USD values follow the quote price and 24h volume ages out, so rows older than
  // MARKET_DATA_MAX_AGE_MS are recomputed from chain, oldest first, a batch per interval.
  const MARKET_DATA_MAX_AGE_MS = Number(process.env.MARKET_DATA_MAX_AGE_MS || 5 * 60_000);
  const MARKET_DATA_BATCH = Number(process.env.MARKET_DATA_BATCH || 25);
  if (process.env.NODE_ENV !== 'test' && repository.findStaleMarketData) {
    let refreshing = false;
    setInterval(async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const stale = await repository.findStaleMarketData!(
          Date.now() - MARKET_DATA_MAX_AGE_MS,
          MARKET_DATA_BATCH,
        );
        for (const address of stale) {
          try {
            await getTokenByAddressUseCase.execute(address);
          } catch {
            // RPC hiccup: the row stays stale and is retried next interval.
          }
        }
      } finally {
        refreshing = false;
      }
    }, 60_000).unref();
  }

  // DR-04: daily hot backups of the SQLite database (DB_BACKUP_INTERVAL_MS=0 disables).
  const DB_BACKUP_INTERVAL_MS = Number(envOr('DB_BACKUP_INTERVAL_MS', String(24 * 60 * 60_000)));
  const DB_BACKUP_KEEP = Number(envOr('DB_BACKUP_KEEP', '7'));
  if (DB_BACKUP_INTERVAL_MS > 0 && process.env.NODE_ENV !== 'test') {
    setInterval(() => {
      try {
        const file = repository.backup(DB_BACKUP_KEEP);
        if (file) logger.info(`[SQLite] backup written to ${file}`);
      } catch (e) {
        logger.error('[SQLite] backup failed', {
          error: { name: (e as Error).name, message: (e as Error).message },
        });
      }
    }, DB_BACKUP_INTERVAL_MS).unref();
  }
}
