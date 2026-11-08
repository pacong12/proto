import { isMemestock, memestockSignals } from '../application/memestock';
import { SPARKLINE_POINTS, sparklineSince } from '../application/sparkline';
import { findAllTokens } from '../application/all-tokens';
import { logger } from '../../observability';
import { formatUnits, type Address } from 'viem';
import {
  gotonFeeSplitterAbi,
  gotonV4GraduatorAbi,
  gotonV4HookAbi,
  resolveFeeSplitter,
  launchpadTokenAbi,
  resolveTokenNetwork,
  resolveNetworkByParam,
  CHAINS,
  type NetworkConfig,
  isAddress,
  ok,
  err,
} from '@goton/shared-types';
import { parseJsonBody, PayloadTooLargeError, safeTokenCompare } from '../../../core';
import {
  cacheHeader,
  readThrough,
  replyCached,
  replyCachedEnvelope,
} from '../../../core/http/cached-reply';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

/** Width of one /api/analytics chart bucket (six per 24h). */
const ANALYTICS_BUCKET_MS = 4 * 60 * 60 * 1000;

/**
 * The configured network a chain param names exactly (chain ID, slug, name or alias), or null.
 * Unlike resolveNetworkByParam it never falls back to the default network.
 */
function findNetworkStrict(param?: string | null): NetworkConfig | null {
  const p = (param || '').toLowerCase().trim();
  if (!p) return null;
  return (
    CHAINS.find((net) =>
      [String(net.chainId), net.slug, net.name, ...(net.aliases ?? [])].some(
        (key) => key.toLowerCase() === p,
      ),
    ) ?? null
  );
}

/** HTTP routes of the tokens module, registered in the order they are matched. */
export function registerTokensRoutes(router: Router, deps: AppContainer): void {
  const {
    cache,
    repository,
    chainIndexer,
    priceFeed,
    tokenController,
    chainRegistry,
    pollers,
    tradeSync,
    getCandlesticksUseCase,
  } = deps;
  router.use(async ({ req, url, replyError, replyEnvelope }) => {
    if (url.pathname === '/api/tokens') {
      if (req.method !== 'GET') {
        return replyError('METHOD_NOT_ALLOWED', 'Method not allowed for /api/tokens', 405, {
          Allow: 'GET',
        });
      }
      const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const rawOffset = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 100);
      const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);
      const version = (url.searchParams.get('version') as 'v1' | 'v2' | null) ?? undefined;
      const rawDeployer = url.searchParams.get('deployer') ?? undefined;
      // Validate deployer is a proper Ethereum address before use — prevents arbitrary strings
      // from polluting cache keys or being passed downstream.
      if (rawDeployer && !isAddress(rawDeployer)) {
        return replyError(
          'INVALID_PARAM',
          'deployer must be a valid Ethereum address (0x + 40 hex chars)',
          400,
        );
      }
      const deployer = rawDeployer;

      const cacheKey = `tokens:list:${limit}:${offset}:${version || 'all'}:${deployer || 'all'}`;
      return replyCachedEnvelope(cache, replyEnvelope, cacheKey, 10, () =>
        tokenController.listTokens(limit, offset, version, deployer),
      );
    }
  });

  // GET /api/sparklines?chainId= — per token, its price path from launch to now (about 40 points,
  // USD, from indexed trades) for the list sparklines.
  router.on('GET', '/api/sparklines', async ({ url, replyEnvelope }) => {
    const network = resolveNetworkByParam(
      url.searchParams.get('chainId') || url.searchParams.get('chain'),
    );
    return replyCachedEnvelope(
      cache,
      replyEnvelope,
      `sparklines:${network.chainId}`,
      60,
      async () => {
        const res = await tokenController.listTokens(100, 0);
        if (!res.success || !res.data) return res;
        const now = Date.now();
        const lines: Record<string, number[]> = {};
        for (const item of res.data) {
          if (resolveTokenNetwork(item.token).chainId !== network.chainId) continue;
          // Hourly candles cover up to 1,000 h (about 41 days); older tokens use daily ones.
          const ageMs = now - (item.token.createdAt || now);
          const resolution = ageMs > 900 * 3_600_000 ? 86_400 : 3_600;
          const candles = await getCandlesticksUseCase.execute(
            item.token.address,
            resolution,
            true,
          );
          lines[item.token.address.toLowerCase()] = sparklineSince(candles, SPARKLINE_POINTS);
        }
        return ok(lines);
      },
    );
  });

  // GET /api/memestock?chainId= — launches with a thesis whose creator still holds a bought
  // position, ranked by momentum (see modules/tokens/application/memestock.ts).
  router.on('GET', '/api/memestock', async ({ url, replyEnvelope }) => {
    const network = resolveNetworkByParam(
      url.searchParams.get('chainId') || url.searchParams.get('chain'),
    );
    return replyCachedEnvelope(
      cache,
      replyEnvelope,
      `memestock:${network.chainId}`,
      15,
      async () => {
        const res = await tokenController.listTokens(100, 0);
        if (!res.success || !res.data) return res;
        const now = Date.now();
        const rows = [];
        for (const item of res.data) {
          if (resolveTokenNetwork(item.token).chainId !== network.chainId) continue;
          const trades = await repository.getTrades(item.token.address, 500, 0);
          const signals = memestockSignals(item.token, trades, now);
          if (!isMemestock(item.token.description, signals)) continue;
          rows.push({ ...item, signals });
        }
        rows.sort(
          (a, b) =>
            b.signals.score - a.signals.score ||
            (b.marketData?.marketCapUsd ?? 0) - (a.marketData?.marketCapUsd ?? 0),
        );
        return ok(rows);
      },
    );
  });

  router.on(
    'POST',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/sync$/,
    async ({ req, url, replyError, replyEnvelope }, syncMatch) => {
      const address = syncMatch[1] as `0x${string}`;
      try {
        let body: {
          txHash?: string;
          chain?: string | number;
          taxConfig?: {
            buyTaxBps?: number;
            sellTaxBps?: number;
            taxRecipient?: `0x${string}`;
            revenueSplit?: {
              creator: number;
              buyback: number;
              holders: number;
              growth: number;
            };
          };
        } = {};
        try {
          // Any JSON parses: only an object is a body (null, arrays or strings crashed below).
          const parsed = await parseJsonBody<unknown>(req, 8192);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            body = parsed as typeof body;
          }
        } catch (e) {
          if (e instanceof PayloadTooLargeError) {
            return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
          }
          // optional body
        }

        const txHash =
          typeof body.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.txHash)
            ? (body.txHash as `0x${string}`)
            : undefined;

        // Refresh or initialize token taxConfig and revenueSplit
        let existing = await repository.findByAddress(address);
        const isNew = !existing;
        let launchBlock: bigint | undefined;
        if (!existing) {
          const chainParam =
            url.searchParams.get('chain') || (body.chain ? String(body.chain) : null);
          const chain = chainRegistry.getChainByParam(chainParam);
          const fetched = await chainIndexer
            .fetchLaunchedTokenFromChain(address, chain.network)
            .catch(() => null);
          if (fetched) {
            existing = fetched;
            // The launch transaction dates the token; without it createdAt is the time of this sync.
            if (txHash) {
              try {
                const receipt = await chain.client.getTransactionReceipt({ hash: txHash });
                const block = await chain.client.getBlock({ blockNumber: receipt.blockNumber });
                launchBlock = receipt.blockNumber;
                existing = {
                  ...existing,
                  createdAt: Number(block.timestamp) * 1000,
                  launchBlock: receipt.blockNumber,
                };
              } catch {
                // keep the fetched values
              }
            }
          }
        }
        if (existing) {
          // API-02: the request body is never trusted for tax data (this endpoint is public).
          // Taxes and the revenue split are read from chain; the body only triggers re-indexing.
          let buyTaxBps = existing.taxConfig?.buyTaxBps ?? 0;
          let sellTaxBps = existing.taxConfig?.sellTaxBps ?? 0;
          let taxRecipient = existing.taxConfig?.taxRecipient ?? existing.deployer;
          let revenueSplit = existing.taxConfig?.revenueSplit;

          const chain = chainRegistry.resolveForToken(existing);
          try {
            const onchainCfg = (await chain.client.readContract({
              address,
              abi: launchpadTokenAbi,
              functionName: 'taxConfig',
            })) as [number, number, Address];
            if (Number(onchainCfg[0]) > 0 || Number(onchainCfg[1]) > 0) {
              buyTaxBps = Number(onchainCfg[0]);
              sellTaxBps = Number(onchainCfg[1]);
              if (onchainCfg[2] && onchainCfg[2] !== '0x0000000000000000000000000000000000000000') {
                taxRecipient = onchainCfg[2];
              }
            }
          } catch {
            // non-fatal
          }

          // In-pool v4 tokens: the fixed-forever tax lives in the hook, the split in the splitter.
          const hook = chain.network.contracts.memeHook;
          if (
            existing.version === 'v4' &&
            hook &&
            hook !== '0x0000000000000000000000000000000000000000'
          ) {
            try {
              const pool = await chain.client.readContract({
                address: hook,
                abi: gotonV4HookAbi,
                functionName: 'pools',
                args: [existing.poolAddress],
              });
              buyTaxBps = Number(pool[3]);
              sellTaxBps = Number(pool[4]);
            } catch {
              // non-fatal
            }
          }
          try {
            const splitter = await resolveFeeSplitter(chain.client, chain.network, address);
            if (splitter) {
              const [holders, burn, creatorShare, liquidity] = await Promise.all(
                (['holdersBps', 'burnBps', 'creatorBps', 'liquidityBps'] as const).map(
                  (functionName) =>
                    chain.client.readContract({
                      address: splitter.address,
                      abi: gotonFeeSplitterAbi,
                      functionName,
                    }),
                ),
              );
              revenueSplit = {
                holders: Number(holders) / 100,
                buyback: Number(burn) / 100,
                creator: Number(creatorShare) / 100,
                growth: Number(liquidity) / 100,
              };
            } else {
              // Before graduation the creator's split is held by the graduator (if one was set).
              const graduator = chain.network.contracts.graduator;
              if (graduator && graduator !== '0x0000000000000000000000000000000000000000') {
                const hasSplit = await chain.client.readContract({
                  address: graduator,
                  abi: gotonV4GraduatorAbi,
                  functionName: 'hasTokenSplit',
                  args: [address],
                });
                if (hasSplit) {
                  const split = await chain.client.readContract({
                    address: graduator,
                    abi: gotonV4GraduatorAbi,
                    functionName: 'tokenSplits',
                    args: [address],
                  });
                  revenueSplit = {
                    holders: Number(split[1]) / 100,
                    buyback: Number(split[2]) / 100,
                    creator: Number(split[3]) / 100,
                    growth: Number(split[4]) / 100,
                  };
                }
              }
            }
          } catch {
            // non-fatal
          }

          await repository.save({
            ...existing,
            taxConfig: {
              buyTaxBps,
              sellTaxBps,
              taxRecipient,
              revenueSplit,
            },
          });
          await cache.del(`token:detail:${address.toLowerCase()}`);
          if (isNew) tradeSync.scheduleBackfill(existing, launchBlock);
        }
        // After the token is saved, so trades in the launch transaction are not dropped.
        if (txHash) await tradeSync.indexFromReceipt(txHash, address);
        Promise.allSettled([...pollers.values()].map((poller) => poller.pollEvents()));
        return replyEnvelope(ok({ synced: true, address, txHash: txHash ?? null }));
      } catch (e) {
        return replyEnvelope(err('SYNC_ERROR', (e as Error).message));
      }
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/balance$/,
    async ({ url, replyEnvelope }, balanceMatch) => {
      const tokenAddress = balanceMatch[1] as `0x${string}`;
      const accountParam = url.searchParams.get('account') as `0x${string}` | null;
      if (!isAddress(accountParam)) {
        return replyEnvelope(err('INVALID_ACCOUNT', 'A valid 0x account address is required'));
      }

      try {
        const token = await repository.findByAddress(tokenAddress);
        const chain = token
          ? chainRegistry.resolveForToken(token)
          : chainRegistry.getChainByParam(url.searchParams.get('chain'));
        const client = chain.client;

        const [balWei, nativeGasWei] = await Promise.all([
          client.readContract({
            address: tokenAddress,
            abi: [
              {
                name: 'balanceOf',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
              },
            ],
            functionName: 'balanceOf',
            args: [accountParam],
          }) as Promise<bigint>,
          client.getBalance({ address: accountParam }).catch(() => 0n),
        ]);

        const decimals = token?.decimals ?? 18;
        const formatted = Number(balWei) / 10 ** decimals;

        return replyEnvelope(
          ok({
            tokenAddress,
            account: accountParam,
            chainId: chain.chainId,
            balanceWei: balWei.toString(),
            nativeGasWei: nativeGasWei.toString(),
            decimals,
            formatted,
          }),
        );
      } catch (e) {
        return replyEnvelope(err('RPC_ERROR', (e as Error).message));
      }
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/rewards$/,
    async ({ url, replyEnvelope }, rewardsMatch) => {
      const tokenAddress = rewardsMatch[1] as `0x${string}`;
      const accountParam = url.searchParams.get('account') as `0x${string}` | null;
      if (!isAddress(accountParam)) {
        return replyEnvelope(
          err('INVALID_ACCOUNT', 'A valid 42-char hex account address is required'),
        );
      }

      try {
        const token = await repository.findByAddress(tokenAddress);
        const chain = token
          ? chainRegistry.resolveForToken(token)
          : chainRegistry.getChainByParam(url.searchParams.get('chain'));
        // Dividends are paid by the token's GotonFeeSplitter (created at launch on in-pool v4
        // chains, at graduation on bonding-curve chains).
        const splitter = await resolveFeeSplitter(chain.client, chain.network, tokenAddress).catch(
          () => null,
        );
        if (!splitter) {
          return replyEnvelope(
            ok({
              tokenAddress,
              account: accountParam,
              distributorAvailable: false,
              earnedWei: '0',
              earnedFormatted: 0,
              snapshotBalanceWei: '0',
              totalDistributedWei: '0',
              rewardAssetSymbol: chain.network.nativeCurrency.symbol,
            }),
          );
        }

        const [earnedWei, totalStreamed] = await Promise.all([
          chain.client
            .readContract({
              address: splitter.address,
              abi: gotonFeeSplitterAbi,
              functionName: 'claimable',
              args: [accountParam],
            })
            .catch(() => 0n),
          chain.client
            .readContract({
              address: splitter.address,
              abi: gotonFeeSplitterAbi,
              functionName: 'totalStreamed',
            })
            .catch(() => 0n),
        ]);

        return replyEnvelope(
          ok({
            tokenAddress,
            account: accountParam,
            distributorAvailable: true,
            distributorAddress: splitter.address,
            earnedWei: earnedWei.toString(),
            earnedFormatted: Number(earnedWei) / 10 ** splitter.quoteDecimals,
            // Splitters checkpoint on every transfer; there is no separate balance snapshot.
            snapshotBalanceWei: '0',
            totalDistributedWei: totalStreamed.toString(),
            rewardAssetSymbol: chain.network.nativeCurrency.symbol,
          }),
        );
      } catch (e) {
        return replyEnvelope(err('REWARD_QUERY_ERROR', (e as Error).message));
      }
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/holders$/,
    async ({ url, replyEnvelope }, holdersMatch) => {
      const address = holdersMatch[1];
      const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
      // 3s, like the token detail: the page reloads holders as soon as a trade moves the price.
      return replyCachedEnvelope(
        cache,
        replyEnvelope,
        `token:holders:${address.toLowerCase()}:${limit}`,
        3,
        () => tokenController.getHolders(address, limit),
      );
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/dev-activity$/,
    async ({ replyEnvelope }, devActivityMatch) => {
      const address = devActivityMatch[1];
      const res = await tokenController.getDevActivity(address);
      return replyEnvelope(res);
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/flow$/,
    async ({ url, replyError, replyEnvelope }, flowMatch) => {
      const address = flowMatch[1] as `0x${string}`;
      const windows: Record<string, number> = {
        '5m': 300_000,
        '1h': 3_600_000,
        '6h': 21_600_000,
        '24h': 86_400_000,
      };
      const windowKey = url.searchParams.get('window') ?? '1h';
      const windowMs = windows[windowKey];
      if (!windowMs)
        return replyError('INVALID_PARAM', 'window must be one of 5m, 1h, 6h, 24h', 400);
      const cacheKey = `token:flow:${address.toLowerCase()}:${windowKey}`;
      const { value, hit } = await readThrough(cache, cacheKey, 10, async () => {
        const flow = (await repository.getTradeFlow?.(address, Date.now() - windowMs)) ?? {
          buyQuote: 0,
          sellQuote: 0,
          buys: 0,
          sells: 0,
          buyers: 0,
          sellers: 0,
        };
        const token = await repository.findByAddress(address);
        const quoteUsd = token ? await chainRegistry.resolveForToken(token).getQuotePriceUsd() : 0;
        const total = flow.buyQuote + flow.sellQuote;
        return {
          window: windowKey,
          ...flow,
          buyVolumeUsd: flow.buyQuote * quoteUsd,
          sellVolumeUsd: flow.sellQuote * quoteUsd,
          // null when there were no trades: no 50/50 placeholder.
          buyPercent: total > 0 ? (flow.buyQuote / total) * 100 : null,
          sellPercent: total > 0 ? (flow.sellQuote / total) * 100 : null,
        };
      });
      return replyEnvelope(ok(value), cacheHeader(hit));
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/buyback$/,
    async ({ replyJson }, buybackMatch) => {
      const address = buybackMatch[1];
      const stats = (await repository.getBuybackStats?.(address)) || {
        totalBurns: 0,
        totalTokensBurned: '0',
        recentBurns: [],
      };
      return replyJson(ok(stats));
    },
  );

  router.on('GET', '/api/buyback/stats', async ({ replyJson }) => {
    const stats = (await repository.getBuybackStats?.()) || {
      totalBurns: 0,
      totalTokensBurned: '0',
      recentBurns: [],
    };
    return replyJson(ok(stats));
  });

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/stream$/,
    async ({ req, corsOrigin }, streamMatch) => {
      const streamAddress = streamMatch[1].toLowerCase() as `0x${string}`;
      let sseController: ReadableStreamDefaultController<Uint8Array> | null = null;
      let sseTimer: ReturnType<typeof setTimeout> | null = null;
      let lastPriceUsd = -1;
      let lastMarketCapUsd = -1;
      let lastGradProgress = -1;
      const encoder = new TextEncoder();
      // Bun closes a connection idle for 10s (idleTimeout): a quiet coin's stream dropped and
      // reconnected every ~10s. A comment line well inside that keeps it open.
      const HEARTBEAT_MS = 5000;
      let lastWriteAt = Date.now();

      function scheduleSsePoll(): void {
        sseTimer = setTimeout(async () => {
          if (!sseController) return;
          try {
            const mkt = await repository.getMarketData(streamAddress);
            if (
              mkt &&
              (mkt.priceUsd !== lastPriceUsd ||
                mkt.marketCapUsd !== lastMarketCapUsd ||
                mkt.graduationProgress !== lastGradProgress)
            ) {
              lastPriceUsd = mkt.priceUsd;
              lastMarketCapUsd = mkt.marketCapUsd ?? lastMarketCapUsd;
              lastGradProgress = mkt.graduationProgress;
              const frame = `data: ${JSON.stringify({ marketData: mkt })}\n\n`;
              sseController.enqueue(encoder.encode(frame));
              lastWriteAt = Date.now();
            } else if (Date.now() - lastWriteAt >= HEARTBEAT_MS) {
              sseController.enqueue(encoder.encode(': ping\n\n'));
              lastWriteAt = Date.now();
            }
            scheduleSsePoll();
          } catch {
            // Non-fatal — SSE connection will be cleaned up on close
          }
        }, 1000); // a DB read: the stream passes a trade on within a second of indexing it
      }

      const sseStream = new ReadableStream<Uint8Array>({
        start(controller) {
          sseController = controller;
          // Initial ping so browser knows the connection is live
          controller.enqueue(encoder.encode(': ping\n\n'));
          scheduleSsePoll();
        },
        cancel() {
          if (sseTimer) {
            clearTimeout(sseTimer);
            sseTimer = null;
          }
          sseController = null;
        },
      });

      // Abort SSE when browser navigates away / closes tab
      if (req.signal) {
        req.signal.addEventListener('abort', () => {
          if (sseTimer) {
            clearTimeout(sseTimer);
            sseTimer = null;
          }
          sseController = null;
        });
      }

      return new Response(sseStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': corsOrigin,
          'X-Accel-Buffering': 'no', // disable Nginx buffering for SSE
        },
      });
    },
  );

  router.on(
    'GET',
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})$/,
    async ({ replyEnvelope }, tokenMatch) => {
      const address = tokenMatch[1];
      // 3s: shorter than the 5s EventPoller cycle.
      return replyCachedEnvelope(
        cache,
        replyEnvelope,
        `token:detail:${address.toLowerCase()}`,
        3,
        () => tokenController.getToken(address),
      );
    },
  );

  // GET /api/analytics?chainId= (or ?chain=) — protocol figures of ONE network. The chain is
  // required and must name a configured network exactly: an unknown one is a 400, never another
  // network's data, and figures (and USD sums) are never mixed across chains.
  router.on('GET', '/api/analytics', async ({ url, replyJson, replyError }) => {
    const chainParam = url.searchParams.get('chainId') || url.searchParams.get('chain');
    const network = findNetworkStrict(chainParam);
    const chain = network
      ? chainRegistry.getAllChains().find((c) => c.chainId === network.chainId)
      : undefined;
    if (!network || !chain) {
      return replyError(
        'INVALID_PARAM',
        chainParam
          ? `Unknown chain "${chainParam.slice(0, 64)}"; expected one of: ${CHAINS.map((n) => `${n.chainId} (${n.slug})`).join(', ')}`
          : 'chainId (or chain) is required: analytics are reported per network',
        400,
      );
    }
    const cacheKey = `protocol:analytics:v2:${network.chainId}`;
    return replyCached(cache, replyJson, cacheKey, 30, async () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const dayAgoMs = now - dayMs;

      const tokens = (await findAllTokens(repository)).filter(
        (t) => resolveTokenNetwork(t).chainId === network.chainId,
      );
      const tokenByAddress = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));

      // Six 4-hour buckets, oldest first, ending now. `start`/`end` are epoch ms so the client
      // can label them in local time; `label` is the bucket's end relative to now.
      const bucketMs = ANALYTICS_BUCKET_MS;
      const bucketCount = Math.round(dayMs / bucketMs);
      const bucketOf = (ts: number): number => {
        const age = now - ts;
        if (age < 0 || age >= dayMs) return -1;
        return bucketCount - 1 - Math.floor(age / bucketMs);
      };
      const makeBuckets = () =>
        Array.from({ length: bucketCount }, (_, i) => {
          const end = now - (bucketCount - 1 - i) * bucketMs;
          const hoursAgo = Math.round((now - end) / 3_600_000);
          return {
            label: hoursAgo === 0 ? 'now' : `-${hoursAgo}h`,
            start: end - bucketMs,
            end,
            value: 0,
          };
        });
      const volumeHistory = makeBuckets();
      const tokenHistory = makeBuckets();
      const feeHistory = makeBuckets();

      let tokensLaunched24h = 0;
      for (const t of tokens) {
        const i = t.createdAt ? bucketOf(t.createdAt) : -1;
        if (i >= 0) {
          tokenHistory[i].value += 1;
          tokensLaunched24h += 1;
        }
      }

      const quotePriceUsd = await chain.getQuotePriceUsd();
      const ethPriceUsd = await priceFeed.getEthPriceUsd();

      // Volume and tax: every indexed trade of this network's tokens in the last 24h, in quote.
      let totalVolumeQuote = 0;
      let taxFeesQuote = 0;
      let tradesWithoutTaxData = 0;
      const trades24h = repository.getTradesSince ? await repository.getTradesSince(dayAgoMs) : [];
      for (const tr of trades24h) {
        const token = tokenByAddress.get(tr.tokenAddress.toLowerCase());
        if (!token) continue; // another network's token
        const i = bucketOf(tr.timestamp);
        if (i < 0) continue;
        const quote = parseFloat(tr.wethAmount || '0');
        if (!Number.isFinite(quote) || quote <= 0) continue;
        totalVolumeQuote += quote;
        volumeHistory[i].value += quote * quotePriceUsd;
        // Each token has its own buy/sell tax; there is no flat protocol swap fee.
        const taxBps = tr.isBuy ? token.taxConfig?.buyTaxBps : token.taxConfig?.sellTaxBps;
        if (taxBps === undefined || taxBps === null) {
          tradesWithoutTaxData += 1;
          continue;
        }
        const tax = (quote * taxBps) / 10_000;
        taxFeesQuote += tax;
        feeHistory[i].value += tax * quotePriceUsd;
      }
      for (const b of [...volumeHistory, ...feeHistory]) b.value = Math.round(b.value * 100) / 100;
      const totalVolumeUsd = totalVolumeQuote * quotePriceUsd;

      // Buyback & burn: real BuybackExecuted events indexed from this network's GotonV4Buyback.
      const burns = (await repository.getBuybackTotals?.(String(network.chainId))) ?? {
        totalBurns: 0,
        totalTokensBurned: '0',
        totalQuoteSpent: '0',
      };
      const buybackQuote = formatUnits(BigInt(burns.totalQuoteSpent), network.quoteTokenDecimals);

      return {
        success: true,
        data: {
          chainId: network.chainId,
          network: network.name,
          quoteSymbol: network.nativeCurrency.symbol,
          quoteDecimals: network.quoteTokenDecimals,
          quotePriceUsd,
          ethPriceUsd,
          windowStart: dayAgoMs,
          windowEnd: now,
          bucketMs,
          totalTokens: tokens.length,
          tokensLaunched24h,
          totalVolume: Math.round(totalVolumeUsd),
          totalVolumeUsd: totalVolumeUsd.toFixed(2),
          totalVolumeQuote: totalVolumeQuote.toFixed(6),
          buyback: {
            source: 'indexed' as const,
            totalBurns: burns.totalBurns,
            totalBurnedTokens: formatUnits(BigInt(burns.totalTokensBurned), 18),
            totalBuybackQuote: buybackQuote,
            totalBuybackUsd: (Number(buybackQuote) * quotePriceUsd).toFixed(2),
          },
          taxFees: {
            estimated: true,
            totalQuote: taxFeesQuote.toFixed(6),
            totalUsd: (taxFeesQuote * quotePriceUsd).toFixed(2),
            tradesWithoutTaxData,
          },
          volumeHistory,
          tokenHistory,
          feeHistory,
        },
        timestamp: now,
      };
    });
  });

  // POST /api/admin/backfill — trigger historical token indexing for a chain.
  // Protected by ADMIN_SECRET; disabled (403) when env var is not configured.
  router.on('POST', '/api/admin/backfill', async ({ req, replyJson, replyError }) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return replyError('FORBIDDEN', 'Admin endpoints disabled: ADMIN_SECRET not configured', 403);
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const providedBearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    // Constant-time comparison prevents timing attacks on the admin secret.
    if (!safeTokenCompare(providedBearer, adminSecret)) {
      return replyError('UNAUTHORIZED', 'Valid Authorization: Bearer <ADMIN_SECRET> required', 401);
    }
    try {
      const body = await parseJsonBody<{
        chain?: string;
        fromBlock?: number | string;
        toBlock?: number | string;
      }>(req, 8192);
      if (!body.chain) {
        return replyError('INVALID_PARAM', 'chain is required (slug or chain ID)', 400);
      }
      const { network, client: targetClient } = chainRegistry.getChainByParam(body.chain);
      const currentBlock = await targetClient.getBlockNumber();

      // Validate block params before passing to BigInt to avoid SyntaxError crash.
      const rawFrom = String(body.fromBlock ?? '');
      const rawTo = String(body.toBlock ?? '');
      if (rawFrom && !/^\d+$/.test(rawFrom)) {
        return replyError('INVALID_PARAM', 'fromBlock must be a non-negative integer', 400);
      }
      if (rawTo && !/^\d+$/.test(rawTo)) {
        return replyError('INVALID_PARAM', 'toBlock must be a non-negative integer', 400);
      }
      const fromBlock = rawFrom ? BigInt(rawFrom) : currentBlock - 100_000n;
      const toBlock = rawTo ? BigInt(rawTo) : currentBlock;

      if (fromBlock > toBlock) {
        return replyError('INVALID_PARAM', 'fromBlock must be <= toBlock', 400);
      }
      // Enforce max span to prevent runaway RPC usage from a single request.
      const MAX_BACKFILL_SPAN = 500_000n;
      if (toBlock - fromBlock > MAX_BACKFILL_SPAN) {
        return replyError(
          'INVALID_PARAM',
          `Block range exceeds maximum allowed span of ${MAX_BACKFILL_SPAN} blocks`,
          400,
        );
      }

      // Run backfill in background; return accepted immediately. The chain's own poller indexes
      // the range, so in-pool (v4) launches, curve launches, trades, orders and holders all land.
      const poller = pollers.get(network.chainId);
      if (!poller) return replyError('INVALID_PARAM', `No indexer for ${network.name}`, 400);
      (async () => {
        const BATCH = 500n;
        let from = fromBlock;
        const tokensBefore = (await findAllTokens(repository)).length;
        let events = 0;
        while (from <= toBlock) {
          const to = from + BATCH - 1n < toBlock ? from + BATCH - 1n : toBlock;
          try {
            events += await poller.indexRange(from, to);
          } catch {
            // non-fatal batch error; continue to next batch
          }
          from = to + 1n;
        }
        const totalNew = (await findAllTokens(repository)).length - tokensBefore;
        logger.info(
          `[Admin] Backfill complete: ${totalNew} new tokens indexed on ${network.name}`,
          { events },
        );
      })();

      return replyJson({
        success: true,
        data: { message: `Backfill started for ${network.name} blocks ${fromBlock}-${toBlock}` },
        timestamp: Date.now(),
      });
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('BACKFILL_ERROR', 'Failed to start backfill', 500);
    }
  });
}
