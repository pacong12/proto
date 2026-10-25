import crypto from 'crypto';
import { ChainRegistry } from './modules/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { V4BuybackKeeperService } from './modules/tokens/infrastructure/keeper/v4-buyback-keeper.service';
import { LimitOrderKeeperService } from './modules/tokens/infrastructure/keeper/limit-order-keeper.service';
import { GraduationKeeperService } from './modules/tokens/infrastructure/keeper/graduation-keeper.service';
import { isMemestock, memestockSignals } from './modules/tokens/application/memestock';
import { SPARKLINE_POINTS, sparklineSince } from './modules/tokens/application/sparkline';
import { findAllTokens } from './modules/tokens/application/all-tokens';
import {
  SqliteTokenRepository,
  ViemChainIndexerAdapter,
  CalculatePricingUseCase,
  GetTokensUseCase,
  GetTokenByAddressUseCase,
  TokenController,
  SecurityGateService,
  SecurityController,
  EventPollerService,
  IpfsService,
  IpfsController,
  CoinGeckoPriceFeedAdapter,
  logger,
  HttpRequestTracker,
  DevopsController,
  RedisCacheAdapter,
  InMemoryCacheAdapter,
  TOKEN_LAUNCHED_V2_EVENT,
} from './index';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  parseAbiItem,
  verifyMessage,
  type PublicClient,
  type Address,
  type Hex,
} from 'viem';
import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  bondingCurveAbi,
  gotonFeeSplitterAbi,
  gotonV4GraduatorAbi,
  gotonV4HookAbi,
  resolveFeeSplitter,
  launchpadTokenAbi,
  type LaunchedTokenEntity,
  type NetworkConfig,
  TransactionIntent,
  type TokenCommentEntity,
  type TradeEventEntity,
  getUserIdentity,
  resolveTokenNetwork,
  resolveNetworkByParam,
  buildCommentSignMessage,
  buildSessionSignMessage,
  sanitizeCreatorProfile,
  resolveSiteUrls,
  type CreatorProfile,
  ok,
  err,
} from '@goton/shared-types';
import {
  safeStringify,
  parseJsonBody,
  PayloadTooLargeError,
  createSessionToken,
  sessionAddressFromRequest,
  resolveCorsOrigin,
  buildSecurityHeaders,
  resolveRateLimitTier,
  deriveEnvelopeStatus,
  chainFor,
  rpcTransport,
  anonymizeIp,
} from './core';
import {
  GetTradesUseCase,
  GetRecentTradesUseCase,
  GetTopTradersUseCase,
  GetCandlesticksUseCase,
  TradeController,
} from './modules/trades';

function createClientForNetwork(cfg: NetworkConfig) {
  return createPublicClient({ chain: chainFor(cfg), transport: rpcTransport(cfg) });
}

export const robinhoodClient: PublicClient = createClientForNetwork(ROBINHOOD_CHAIN);
export const arcClient: PublicClient = createClientForNetwork(ARC_CHAIN);
export const publicClient: PublicClient = robinhoodClient; // Backward compatibility alias

const PORT =
  process.env.NODE_ENV === 'test'
    ? 0
    : parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10);

const redisUrl = process.env.REDIS_URL || undefined;
const redisCache = new RedisCacheAdapter(redisUrl, logger);
// In-memory fallback for rate limiting when Redis is unavailable.
const memoryCache = new InMemoryCacheAdapter();
// Unified cache: Redis when available, transparent in-memory when not.
const cache = redisCache;

const repository = new SqliteTokenRepository();
const chainIndexer = new ViemChainIndexerAdapter();
const priceFeed = new CoinGeckoPriceFeedAdapter({
  initialPrice: process.env.NODE_ENV === 'test' ? 2500 : undefined,
});
const calculatePricing = new CalculatePricingUseCase();
const getTokensUseCase = new GetTokensUseCase(
  repository,
  chainIndexer,
  priceFeed,
  calculatePricing,
);
const getTokenByAddressUseCase = new GetTokenByAddressUseCase(
  repository,
  chainIndexer,
  calculatePricing,
  priceFeed,
  Date.now,
  (token) => scheduleTradeBackfill(token),
);
const tokenController = new TokenController(
  getTokensUseCase,
  getTokenByAddressUseCase,
  repository,
  priceFeed,
);

const getTradesUseCase = new GetTradesUseCase(repository);
const getRecentTradesUseCase = new GetRecentTradesUseCase(repository);
const getTopTradersUseCase = new GetTopTradersUseCase(repository, repository, priceFeed);
const getCandlesticksUseCase = new GetCandlesticksUseCase(repository, repository);

export const tradeController = new TradeController(
  getTradesUseCase,
  getRecentTradesUseCase,
  getTopTradersUseCase,
  getCandlesticksUseCase,
);

const securityGateService = new SecurityGateService();
const securityController = new SecurityController(securityGateService);

const ipfsService = new IpfsService();
const ipfsController = new IpfsController(ipfsService);

export const chainRegistry = new ChainRegistry(robinhoodClient, arcClient, priceFeed);

// Dedicated pollers for each supported chain (Robinhood Chain & Arc Network)
const robinhoodPoller = new EventPollerService(
  robinhoodClient,
  repository,
  chainIndexer,
  calculatePricing,
  priceFeed,
  ROBINHOOD_CHAIN,
);

const arcPoller = new EventPollerService(
  arcClient,
  repository,
  chainIndexer,
  calculatePricing,
  priceFeed,
  ARC_CHAIN,
);

export const eventPoller: EventPollerService = robinhoodPoller; // Backward compatibility alias

const requestTracker = new HttpRequestTracker(logger, cache);
const devopsController = new DevopsController(requestTracker);

// Rate limiting: namespaced by tier so crawler and API buckets do not collide.
// Falls back to in-memory when Redis throws (Redis down should not open-pass the server).
async function checkRateLimit(
  ip: string,
  limit = 120,
  windowMs = 60_000,
  tier: 'api' | 'crawler' | 'upload' | 'terminal' = 'api',
): Promise<boolean> {
  const key = `ratelimit:${tier}:${ip}`;
  try {
    const count = await cache.increment(key, windowMs);
    return count <= limit;
  } catch {
    // Redis unavailable: fall through to in-memory counter so rate limiting still applies.
    logger.warn('Rate limit Redis unavailable, using in-memory fallback', {
      ip: anonymizeIp(ip),
    });
    const count = await memoryCache.increment(key, windowMs);
    return count <= limit;
  }
}

// Constant-time bearer token comparison to prevent timing side-channel attacks.
function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Start background event poller worker loop for both Robinhood and Arc chains.
//
// Strategy: adaptive polling with getLogs (HTTP-only RPC — no WebSocket available).
//
// Why getLogs polling and not watchContractEvent / WebSocket:
//   - Both RPC endpoints (Robinhood, Arc) expose HTTP only; no wss:// available.
//   - viem watchContractEvent over HTTP is identical to getLogs polling internally,
//     but lacks lastPolledBlock tracking (events lost on restart) and batching.
//   - getLogs polling is reliable, idempotent, and retries the same block range
//     on failure without permanently skipping data.
//
// Adaptive interval:
//   - Base: 10s when idle (no events found last cycle) → low RPC load
//   - Active: 3s when events were found last cycle → fast catch-up
//   - Catch-up: while the cursor is behind the head (after a restart or an RPC outage), poll
//     again after POLL_INTERVAL_CATCH_UP_MS until it is current.
//   - Robinhood block time ~100ms (L2); Arc ~500ms. One cycle covers up to
//     INDEXER_MAX_BLOCK_RANGE (2,000) blocks, far more than an idle interval produces.
//
// Chains are staggered by 5s to avoid simultaneous RPC bursts.
// Recursive setTimeout (not setInterval) ensures a slow RPC cycle never overlaps the next.
const POLL_INTERVAL_IDLE_MS = 10_000; // no events found → back off
const POLL_INTERVAL_ACTIVE_MS = 3_000; // events found    → stay responsive
const POLL_INTERVAL_CATCH_UP_MS = 250; // behind the head → keep going

let robinhoodPolling = false;
let robinhoodPollIntervalMs = POLL_INTERVAL_IDLE_MS;
function scheduleRobinhoodPoll(): void {
  setTimeout(async () => {
    if (!robinhoodPolling) {
      robinhoodPolling = true;
      try {
        const found = await robinhoodPoller.pollEvents();
        // Tighten interval when there is active trading; relax when idle
        robinhoodPollIntervalMs = robinhoodPoller.isBehind
          ? POLL_INTERVAL_CATCH_UP_MS
          : found > 0
            ? POLL_INTERVAL_ACTIVE_MS
            : POLL_INTERVAL_IDLE_MS;
      } catch {
        /* non-fatal — lastPolledBlock not advanced, next cycle retries */
      } finally {
        robinhoodPolling = false;
      }
    }
    scheduleRobinhoodPoll();
  }, robinhoodPollIntervalMs);
}
let arcPolling = false;
let arcPollIntervalMs = POLL_INTERVAL_IDLE_MS;
function scheduleArcPoll(): void {
  setTimeout(async () => {
    if (!arcPolling) {
      arcPolling = true;
      try {
        const found = await arcPoller.pollEvents();
        arcPollIntervalMs = arcPoller.isBehind
          ? POLL_INTERVAL_CATCH_UP_MS
          : found > 0
            ? POLL_INTERVAL_ACTIVE_MS
            : POLL_INTERVAL_IDLE_MS;
      } catch {
        /* non-fatal */
      } finally {
        arcPolling = false;
      }
    }
    scheduleArcPoll();
  }, arcPollIntervalMs);
}
scheduleRobinhoodPoll();
// Stagger Arc chain by 30s to avoid simultaneous RPC bursts
setTimeout(scheduleArcPoll, 30_000);

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
const BUYBACK_KEEPER_INTERVAL_MS = Number(envOr('BUYBACK_KEEPER_INTERVAL_MS', String(10 * 60_000)));
/**
 * Smallest accrued amount (quote units) worth a keeper transaction, so the keeper never spends
 * more on gas than it moves: 0.001 ETH on Robinhood Chain, 1 USDC (6 decimals) on Arc.
 */
const KEEPER_MIN_QUOTE: Record<number, bigint> = {
  [ROBINHOOD_CHAIN.chainId]: BigInt(envOr('KEEPER_MIN_QUOTE_ROBINHOOD', '1000000000000000')),
  [ARC_CHAIN.chainId]: BigInt(envOr('KEEPER_MIN_QUOTE_ARC', '1000000')),
};

function startBuybackKeepers(): void {
  const key = process.env.KEEPER_PRIVATE_KEY?.trim();
  if (!key || process.env.NODE_ENV === 'test') return;
  const account = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as Hex);
  for (const [network, client] of [
    [ROBINHOOD_CHAIN, robinhoodClient],
    [ARC_CHAIN, arcClient],
  ] as const) {
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
      KEEPER_MIN_QUOTE[network.chainId] ?? 0n,
    );
    const limitKeeper = new LimitOrderKeeperService(
      client,
      walletClient,
      repository,
      network,
      network.chainId === ARC_CHAIN.chainId ? 10n ** 12n : 1n,
    );
    const graduationKeeper = new GraduationKeeperService(client, walletClient, repository, network);
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

const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);

/**
 * Tokens can enter the database after the live poller has passed their first trades (found on a
 * page visit, or synced late). Their earlier curve trades are re-indexed in the background, from
 * the launch block when known, otherwise over TRADE_BACKFILL_BLOCKS (default 4M blocks, about 12
 * days on Robinhood Chain).
 */
const TRADE_BACKFILL_BLOCKS = BigInt(process.env.TRADE_BACKFILL_BLOCKS || '4000000');
function scheduleTradeBackfill(token: LaunchedTokenEntity, fromBlock?: bigint): void {
  if (token.version !== 'v2' || process.env.NODE_ENV === 'test') return;
  const poller =
    chainRegistry.resolveForToken(token).network.chainId === ARC_CHAIN.chainId
      ? arcPoller
      : robinhoodPoller;
  const chain = chainRegistry.resolveForToken(token);
  void (async () => {
    const head = await chain.client.getBlockNumber();
    const from = fromBlock ?? (head > TRADE_BACKFILL_BLOCKS ? head - TRADE_BACKFILL_BLOCKS : 0n);
    const found = await poller.backfillCurveTrades(token, from);
    if (found > 0) logger.info(`[Backfill] ${found} trade(s) for ${token.symbol} ${token.address}`);
  })().catch((e) =>
    logger.warn('[Backfill] curve trade backfill failed', {
      error: { name: (e as Error).name, message: (e as Error).message },
    }),
  );
}

async function indexTradeFromReceipt(
  txHash: `0x${string}`,
  tokenAddress: `0x${string}`,
): Promise<void> {
  const token = await repository.findByAddress(tokenAddress);
  if (!token) return;

  const chain = chainRegistry.resolveForToken(token);
  const client = chain.client;
  const quotePriceUsd = await chain.getQuotePriceUsd();

  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (!receipt || receipt.status !== 'success') return;

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [TRADE_EVENT],
        data: log.data,
        topics: log.topics,
      });
      const { trader, isBuy, ethAmount, tokenAmount } = decoded.args as {
        trader: Address;
        isBuy: boolean;
        ethAmount: bigint;
        tokenAmount: bigint;
      };
      if (ethAmount === undefined || tokenAmount === undefined) continue;

      const ethAmountNum = Number(ethAmount) / 1e18;
      const tokenAmountNum = Number(tokenAmount) / 1e18;

      let priceUsd = 0;
      if (token.version === 'v2') {
        const curveTarget = (token.curveAddress || log.address) as Address;
        try {
          const [vEth, vToken] = await Promise.all([
            client.readContract({
              address: curveTarget,
              abi: bondingCurveAbi,
              functionName: 'virtualEthReserve',
            }) as Promise<bigint>,
            client.readContract({
              address: curveTarget,
              abi: bondingCurveAbi,
              functionName: 'virtualTokenReserve',
            }) as Promise<bigint>,
          ]);
          if (vToken > 0n) {
            priceUsd = (Number(vEth) / Number(vToken)) * quotePriceUsd;
          }
        } catch {
          // fallback
        }
      }

      if (priceUsd <= 0) {
        const priceNative = tokenAmountNum > 0 ? ethAmountNum / tokenAmountNum : 0;
        priceUsd = priceNative * quotePriceUsd;
      }

      let timestamp = Date.now();
      try {
        const block = await client.getBlock({ blockNumber: receipt.blockNumber });
        timestamp = Number(block.timestamp) * 1000;
      } catch {
        timestamp = Date.now();
      }

      const trade: TradeEventEntity = {
        id: `${receipt.transactionHash}-${log.logIndex}`,
        tokenAddress: token.address,
        poolAddress: token.poolAddress,
        trader,
        isBuy,
        tokenAmount: tokenAmountNum.toFixed(4),
        wethAmount: ethAmountNum.toFixed(6),
        priceUsd,
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
        timestamp,
      };

      await repository.saveTrade(trade);
      // Invalidate caches so next poll immediately gets fresh data after a new trade
      await Promise.allSettled([
        cache.del(`token:detail:${tokenAddress.toLowerCase()}`),
        cache.delPrefix(`token:holders:${tokenAddress.toLowerCase()}`),
      ]);
      if (token.version === 'v2' && priceUsd > 0) {
        const mkt = await repository.getMarketData(token.address);
        if (mkt) {
          const supplyTokens = token.totalSupply
            ? Number(BigInt(token.totalSupply) / 10n ** BigInt(token.decimals || 18))
            : 1_000_000_000;
          await repository.saveMarketData({
            ...mkt,
            priceUsd,
            priceInWeth: priceUsd / quotePriceUsd,
            marketCapUsd: priceUsd * supplyTokens,
            fdvUsd: priceUsd * supplyTokens,
          });
          // Invalidate cached detail so price update is visible on next SSE/poll cycle
          await cache.del(`token:detail:${tokenAddress.toLowerCase()}`);
        }
      }
    } catch {
      // not a trade event
    }
  }
}

async function routeRequest(req: Request, clientIp: string): Promise<Response> {
  const url = new URL(req.url);

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get('origin') || '';
  const corsOrigin = resolveCorsOrigin(url.pathname, requestOrigin, allowedOrigins);
  const headers = buildSecurityHeaders(corsOrigin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const replyJson = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
    new Response(safeStringify(data), {
      status,
      headers: { ...headers, ...extraHeaders },
    });

  const replyError = (
    code: string,
    message: string,
    status = 400,
    extraHeaders: Record<string, string> = {},
  ) =>
    new Response(
      safeStringify({
        success: false,
        data: null,
        error: { code, message },
        timestamp: Date.now(),
      }),
      { status, headers: { ...headers, ...extraHeaders } },
    );

  const envelopeStatus = (env: { success: boolean; error?: { code?: string } | null }): number => {
    return deriveEnvelopeStatus(env);
  };

  const replyEnvelope = (
    env: { success: boolean; error?: { code?: string } | null },
    extraHeaders: Record<string, string> = {},
  ) =>
    new Response(safeStringify(env), {
      status: envelopeStatus(env),
      headers: { ...headers, ...extraHeaders },
    });

  const isHealthProbe = url.pathname === '/health' || url.pathname === '/';
  const { tier: rateTier, maxRequests } = resolveRateLimitTier(url.pathname, req.method);
  if (!isHealthProbe && !(await checkRateLimit(clientIp, maxRequests, 60_000, rateTier))) {
    return replyError('RATE_LIMIT_EXCEEDED', 'Too many requests, please slow down.', 429);
  }

  // DevOps Observability Dashboard & Telemetry Endpoints — fail-closed auth.
  // If DEVOPS_AUTH_TOKEN is not configured, the routes are disabled entirely to prevent
  // accidental exposure of memory stats, request logs, and stack traces.
  const devopsToken = process.env.DEVOPS_AUTH_TOKEN;
  const isDevopsPath =
    url.pathname === '/devops' ||
    url.pathname === '/api/devops/telemetry' ||
    url.pathname === '/api/devops/metrics';

  if (isDevopsPath) {
    // Fail-closed across production, staging, and development if token is not configured.
    // Only bypassed in test runner environment where mocks drive unauthenticated telemetry.
    if (!devopsToken && process.env.NODE_ENV !== 'test') {
      return replyError(
        'FORBIDDEN',
        'DevOps endpoints disabled: DEVOPS_AUTH_TOKEN not configured',
        403,
      );
    }
    if (devopsToken) {
      const authHeader = req.headers.get('authorization') || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      if (!safeTokenCompare(bearerToken, devopsToken)) {
        if (url.pathname === '/devops') {
          const devopsNonce = crypto.randomBytes(16).toString('base64');
          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'nonce-${devopsNonce}'; style-src 'nonce-${devopsNonce}'">
  <title>401 Unauthorized - DevOps Gateway</title>
  <style nonce="${devopsNonce}">
    body { background: #121212; color: #ececec; font-family: ui-monospace, Menlo, monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1a1a1a; border: 1px solid #292929; border-radius: 12px; padding: 24px; max-width: 420px; text-align: center; }
    h1 { font-size: 18px; color: #ef4444; margin-bottom: 8px; }
    p { font-size: 13px; color: #888; line-height: 1.5; margin-bottom: 16px; }
    input { width: 100%; box-sizing: border-box; background: #121212; border: 1px solid #333; color: #fff; padding: 8px 12px; border-radius: 6px; font-family: inherit; font-size: 13px; margin-bottom: 12px; }
    button { width: 100%; background: #10b981; color: #000; font-weight: 700; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
  </style>
  <script nonce="${devopsNonce}">
    async function authenticate(e) {
      e.preventDefault();
      const token = document.getElementById('token-input').value;
      const res = await fetch('/devops', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        // Safe DOM replacement — avoids document.write
        document.documentElement.innerHTML = await res.text();
      } else {
        document.getElementById('err').textContent = 'Authentication failed.';
      }
    }
  </script>
</head>
<body>
  <div class="card">
    <h1>DevOps Authentication Required</h1>
    <p>This telemetry dashboard is restricted to authorized engineers.</p>
    <form onsubmit="authenticate(event)">
      <input type="password" id="token-input" placeholder="Enter DEVOPS_AUTH_TOKEN..." required autofocus />
      <button type="submit">Authenticate</button>
    </form>
    <p id="err" style="color:#ef4444;margin-top:8px;"></p>
  </div>
</body>
</html>`,
            {
              status: 401,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'WWW-Authenticate': 'Bearer realm="Goton DevOps"',
              },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Access denied. Valid DevOps token required.' },
          }),
          {
            status: 401,
            headers: { ...headers, 'WWW-Authenticate': 'Bearer realm="Goton DevOps"' },
          },
        );
      }
    }
  }
  if (url.pathname === '/devops') {
    return new Response(devopsController.getDashboardHtml(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (url.pathname === '/api/devops/telemetry' && req.method === 'GET') {
    return new Response(safeStringify(devopsController.getTelemetry()), { headers });
  }

  if (url.pathname === '/api/devops/metrics' && req.method === 'GET') {
    return new Response(devopsController.getPrometheusMetrics(), {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Health check & DevOps telemetry summary
  // Health probe: return minimal status only — no memory stats visible to public.
  // Memory diagnostics are available on the authenticated /api/devops/telemetry endpoint.
  if (url.pathname === '/health' || url.pathname === '/') {
    return new Response(
      safeStringify({
        status: 'ok',
        service: 'goton-api',
        timestamp: Date.now(),
      }),
      { headers },
    );
  }
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
    if (rawDeployer && !/^0x[a-fA-F0-9]{40}$/.test(rawDeployer)) {
      return replyError(
        'INVALID_PARAM',
        'deployer must be a valid Ethereum address (0x + 40 hex chars)',
        400,
      );
    }
    const deployer = rawDeployer;

    const cacheKey = `tokens:list:${limit}:${offset}:${version || 'all'}:${deployer || 'all'}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return replyJson(cached, 200, { 'x-cache': 'HIT' });
    }

    const res = await tokenController.listTokens(limit, offset, version, deployer);
    if (res.success) {
      await cache.set(cacheKey, res, 10); // Cache for 10s
    }
    return replyJson(res, 200, { 'x-cache': 'MISS' });
  }

  // GET /api/sparklines?chainId= — per token, its price path from launch to now (about 40 points,
  // USD, from indexed trades) for the list sparklines.
  if (url.pathname === '/api/sparklines' && req.method === 'GET') {
    const network = resolveNetworkByParam(
      url.searchParams.get('chainId') || url.searchParams.get('chain'),
    );
    const cacheKey = `sparklines:${network.chainId}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    const res = await tokenController.listTokens(100, 0);
    if (!res.success || !res.data) return replyJson(res, 500);
    const now = Date.now();
    const lines: Record<string, number[]> = {};
    for (const item of res.data) {
      if (resolveTokenNetwork(item.token).chainId !== network.chainId) continue;
      // Hourly candles cover up to 1,000 h (about 41 days); older tokens use daily ones.
      const ageMs = now - (item.token.createdAt || now);
      const resolution = ageMs > 900 * 3_600_000 ? 86_400 : 3_600;
      const candles = await repository.getCandlesticks(item.token.address, resolution, true);
      lines[item.token.address.toLowerCase()] = sparklineSince(candles, SPARKLINE_POINTS);
    }
    const payload = ok(lines);
    await cache.set(cacheKey, payload, 60);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // GET /api/memestock?chainId= — launches with a thesis whose creator still holds a bought
  // position, ranked by momentum (see modules/tokens/application/memestock.ts).
  if (url.pathname === '/api/memestock' && req.method === 'GET') {
    const network = resolveNetworkByParam(
      url.searchParams.get('chainId') || url.searchParams.get('chain'),
    );
    const cacheKey = `memestock:${network.chainId}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    const res = await tokenController.listTokens(100, 0);
    if (!res.success || !res.data) return replyJson(res, 500);
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
    const payload = ok(rows);
    await cache.set(cacheKey, payload, 15);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // GET /api/users/resolve?query=:query
  if (url.pathname === '/api/users/resolve' && req.method === 'GET') {
    const q = url.searchParams.get('query') || '';
    if (!q) {
      return replyError('INVALID_PARAM', 'query is required', 400);
    }
    const resolvedAddress = repository.findAddressByIdentity
      ? await repository.findAddressByIdentity(q)
      : null;
    if (!resolvedAddress) {
      return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
    }
    const identity = getUserIdentity(resolvedAddress);
    return replyJson(ok({ address: resolvedAddress, identity }), 200);
  }

  // Follows: GET /api/users/:id/follows?viewer=, GET /api/users/:id/followers|following,
  // POST /api/users/:id/follow { userAddress } (wallet session required, toggles).
  const followMatch = url.pathname.match(
    /^\/api\/users\/([a-zA-Z0-9_#.-]+)\/(follows|followers|following|follow)$/,
  );
  if (followMatch) {
    const [, identifier, action] = followMatch;
    let address = identifier;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      const resolved = repository.findAddressByIdentity
        ? await repository.findAddressByIdentity(address)
        : null;
      if (!resolved) {
        return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
      }
      address = resolved;
    }
    if (!repository.getFollowStats || !repository.toggleFollow || !repository.listFollows) {
      return replyError('NOT_SUPPORTED', 'Follows are not available', 501);
    }

    if (action === 'follow' && req.method === 'POST') {
      try {
        const body = await parseJsonBody<{ userAddress?: string }>(req, 2048);
        const userAddress = String(body.userAddress || '').trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
          return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to follow', 400);
        }
        if (userAddress.toLowerCase() === address.toLowerCase()) {
          return replyError('INVALID_FOLLOW', 'You cannot follow yourself', 400);
        }
        const sessionError = requireSocialSession(req, userAddress, 'follow');
        if (sessionError) {
          return replyError(sessionError.code, sessionError.message, sessionError.status);
        }
        return replyJson(ok(await repository.toggleFollow(userAddress, address)), 200);
      } catch (e) {
        if (e instanceof PayloadTooLargeError) {
          return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
        }
        return replyError('FOLLOW_ERROR', 'Failed to process follow', 400);
      }
    }

    if (req.method === 'GET' && action === 'follows') {
      const viewer = url.searchParams.get('viewer') ?? undefined;
      const validViewer = viewer && /^0x[a-fA-F0-9]{40}$/.test(viewer) ? viewer : undefined;
      return replyJson(ok(await repository.getFollowStats(address, validViewer)), 200);
    }

    if (req.method === 'GET' && (action === 'followers' || action === 'following')) {
      const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 100), 500);
      const rows = await repository.listFollows(address, action, limit);
      return replyJson(ok(rows.map((r) => ({ ...r, identity: getUserIdentity(r.address) }))), 200);
    }

    return replyError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
  }

  // GET /api/users/:identifier/portfolio
  const userPortfolioMatch = url.pathname.match(/^\/api\/users\/([a-zA-Z0-9_#.-]+)\/portfolio$/);
  if (userPortfolioMatch && req.method === 'GET') {
    const identifier = userPortfolioMatch[1];
    let address = identifier;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      const resolved = repository.findAddressByIdentity
        ? await repository.findAddressByIdentity(address)
        : null;
      if (!resolved) {
        return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
      }
      address = resolved;
    }

    const positions = repository.getUserPositions ? await repository.getUserPositions(address) : [];
    return replyJson(ok(positions), 200);
  }

  // GET /api/users/:identifier
  const userMatch = url.pathname.match(/^\/api\/users\/([a-zA-Z0-9_#.-]+)$/);
  if (userMatch && req.method === 'GET') {
    const identifier = userMatch[1];
    let address = identifier;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      const resolved = repository.findAddressByIdentity
        ? await repository.findAddressByIdentity(address)
        : null;
      if (!resolved) {
        return replyJson(err('USER_NOT_FOUND', 'User identity could not be resolved'), 404);
      }
      address = resolved;
    }

    const identity = getUserIdentity(address);
    return replyJson(ok({ address, identity }), 200);
  }

  // GET /api/trades (global recent protocol trades or trades by trader)
  if (url.pathname === '/api/trades' && req.method === 'GET') {
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '30', 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 30 : rawLimit));
    const trader = url.searchParams.get('trader') || undefined;
    const res = await tradeController.getRecentTrades(trader, limit);
    return replyEnvelope(res, { 'Cache-Control': 'public, max-age=2' });
  }

  // GET /api/trades/:txHash (lookup trade by transaction hash)
  const singleTxMatch = url.pathname.match(/^\/api\/trades\/(0x[a-fA-F0-9]{64})$/);
  if (singleTxMatch && req.method === 'GET') {
    const txHash = singleTxMatch[1];
    const trade = repository.findTradeByHash ? await repository.findTradeByHash(txHash) : null;
    if (!trade) {
      return replyJson(err('NOT_FOUND', 'Transaction not found in protocol activity'), 404);
    }
    return replyJson(ok(trade));
  }

  const tradesMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/trades$/);
  if (tradesMatch && req.method === 'GET') {
    const address = tradesMatch[1];
    // Clamp limit/offset to prevent unbounded DB allocations.
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const rawOffset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const limit = Math.min(200, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);
    const res = await tradeController.getTrades(address, limit, offset);
    return replyEnvelope(res, {
      'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
    });
  }

  // POST /api/tokens/:address/sync — trigger immediate on-demand blockchain event polling & receipt indexing
  const syncMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/sync$/);
  if (syncMatch && req.method === 'POST') {
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
        body = await parseJsonBody<typeof body>(req, 8192);
      } catch (e) {
        if (e instanceof PayloadTooLargeError) {
          return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
        }
        // optional body
      }

      const txHash =
        body.txHash && body.txHash.startsWith('0x') && body.txHash.length === 66
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
        if (isNew) scheduleTradeBackfill(existing, launchBlock);
      }
      // After the token is saved, so trades in the launch transaction are not dropped.
      if (txHash) await indexTradeFromReceipt(txHash, address);
      Promise.allSettled([robinhoodPoller.pollEvents(), arcPoller.pollEvents()]);
      return replyEnvelope(ok({ synced: true, address, txHash: body.txHash ?? null }));
    } catch (e) {
      return replyEnvelope(err('SYNC_ERROR', (e as Error).message));
    }
  }

  // GET /api/tokens/:address/balance?account=0x... — on-chain balance query endpoint with native RPC resilience
  const balanceMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/balance$/);
  if (balanceMatch && req.method === 'GET') {
    const tokenAddress = balanceMatch[1] as `0x${string}`;
    const accountParam = url.searchParams.get('account') as `0x${string}` | null;
    if (!accountParam || !accountParam.startsWith('0x') || accountParam.length !== 42) {
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
  }
  // GET /api/tokens/:address/rewards?account=0x... — Argus-style holder dividend rewards query
  const rewardsMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/rewards$/);
  if (rewardsMatch && req.method === 'GET') {
    const tokenAddress = rewardsMatch[1] as `0x${string}`;
    const accountParam = url.searchParams.get('account') as `0x${string}` | null;
    if (!accountParam || !/^0x[a-fA-F0-9]{40}$/.test(accountParam)) {
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
  }

  // GET /api/tokens/:address/holders
  const holdersMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/holders$/);
  if (holdersMatch && req.method === 'GET') {
    const address = holdersMatch[1];
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const holdersCacheKey = `token:holders:${address.toLowerCase()}:${limit}`;
    const holdersCached = await cache.get<unknown>(holdersCacheKey);
    if (holdersCached) {
      return replyEnvelope(
        holdersCached as { success: boolean; error?: { code?: string } | null },
        { 'x-cache': 'HIT' },
      );
    }
    const res = await tokenController.getHolders(address, limit);
    if (res.success) await cache.set(holdersCacheKey, res, 10); // 10s — holders change only on new trades
    return replyEnvelope(res, { 'x-cache': 'MISS' });
  }

  // GET /api/tokens/:address/ohlcv
  const ohlcvMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/ohlcv$/);
  if (ohlcvMatch && req.method === 'GET') {
    const address = ohlcvMatch[1];
    const resolution = parseInt(url.searchParams.get('resolution') ?? '1', 10);
    const fillGaps = url.searchParams.get('fillGaps') !== 'false';
    const res = await tradeController.getCandlesticks(address, resolution, fillGaps);
    return replyEnvelope(res, {
      'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
    });
  }
  // GET /api/tokens/:address/top-traders
  const topTradersMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/top-traders$/);
  if (topTradersMatch && req.method === 'GET') {
    const address = topTradersMatch[1];
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
    const res = await tradeController.getTopTraders(address, limit);
    return replyEnvelope(res, {
      'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
    });
  }

  // GET /api/tokens/:address/dev-activity
  const devActivityMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/dev-activity$/);
  if (devActivityMatch && req.method === 'GET') {
    const address = devActivityMatch[1];
    const res = await tokenController.getDevActivity(address);
    return replyEnvelope(res);
  }

  // GET /api/feed or /api/callouts — global community callouts across all tokens
  if ((url.pathname === '/api/feed' || url.pathname === '/api/callouts') && req.method === 'GET') {
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const rawOffset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);
    const viewer = url.searchParams.get('viewer') || undefined;
    const author = url.searchParams.get('author') || undefined;
    const callouts = (await repository.getFeedCallouts?.(limit, offset, viewer, author)) || [];
    return new Response(safeStringify({ success: true, data: callouts, timestamp: Date.now() }), {
      headers,
    });
  }

  // GET & POST /api/tokens/:address/comments
  const commentsMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/comments$/);
  if (commentsMatch && req.method === 'GET') {
    const address = commentsMatch[1];
    const viewer = url.searchParams.get('viewer') || undefined;
    const comments = (await repository.getComments?.(address, viewer)) || [];
    return new Response(safeStringify({ success: true, data: comments, timestamp: Date.now() }), {
      headers,
    });
  }

  if (commentsMatch && req.method === 'POST') {
    const address = commentsMatch[1];
    try {
      const body = await parseJsonBody<{
        content?: string;
        authorAddress?: string;
        imageUrl?: string;
        targetMcap?: string;
        positionUsd?: number;
        callType?: 'call' | 'comment';
        parentId?: string;
        quotedCalloutId?: string;
        signature?: Hex;
        timestamp?: number;
      }>(req, 32_768);
      const content = String(body.content || '').trim();
      const authorAddress = String(body.authorAddress || '').trim();
      const signature = body.signature;
      const timestamp = body.timestamp;
      const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : undefined;
      const targetMcap = body.targetMcap ? String(body.targetMcap).trim() : undefined;
      const parentId = body.parentId ? String(body.parentId).trim() : undefined;
      const quotedCalloutId = body.quotedCalloutId
        ? String(body.quotedCalloutId).trim()
        : undefined;
      let positionUsd =
        typeof body.positionUsd === 'number' && !isNaN(body.positionUsd)
          ? body.positionUsd
          : undefined;
      let supplyPercent: number | undefined;
      const callType = body.callType === 'comment' ? 'comment' : 'call';
      if (!content || content.length > 500) {
        return replyError(
          'INVALID_COMMENT',
          'Comment content must be between 1 and 500 characters',
          400,
        );
      }
      if (!authorAddress || !/^0x[a-fA-F0-9]{40}$/.test(authorAddress)) {
        return replyError(
          'INVALID_AUTHOR',
          'Valid Ethereum wallet address is required to comment',
          400,
        );
      }

      // Cryptographic authentication: verify wallet signature to defeat author impersonation
      if (signature) {
        if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
          return replyError(
            'INVALID_TIMESTAMP',
            'Valid millisecond timestamp is required with signature',
            400,
          );
        }
        const ageMs = Math.abs(Date.now() - timestamp);
        if (ageMs > 10 * 60 * 1000) {
          return replyError(
            'EXPIRED_SIGNATURE',
            'Signature timestamp has expired (validity window is 10 minutes)',
            401,
          );
        }

        const signMessage = buildCommentSignMessage({
          tokenAddress: address,
          authorAddress,
          content,
          timestamp,
        });

        let isValid = false;
        try {
          isValid = await verifyMessage({
            address: authorAddress as Address,
            message: signMessage,
            signature,
          });
        } catch (e) {
          if (e instanceof PayloadTooLargeError) {
            return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
          }
          isValid = false;
        }

        if (!isValid) {
          return replyError(
            'INVALID_SIGNATURE',
            'Cryptographic signature does not match author wallet address',
            401,
          );
        }
      } else if (process.env.NODE_ENV !== 'test') {
        return replyError(
          'SIGNATURE_REQUIRED',
          'Cryptographic wallet signature is required to post comments and callouts',
          401,
        );
      }

      // Validate imageUrl — only allow https:// or ipfs:// to block javascript: injection.
      if (imageUrl) {
        if (imageUrl.length > 2048 || !/^(https:\/\/|ipfs:\/\/)/.test(imageUrl)) {
          return replyError(
            'INVALID_IMAGE_URL',
            'imageUrl must be an https:// or ipfs:// URL (max 2048 chars)',
            400,
          );
        }
      }

      // Callout position check: callers must hold a position in the token to post a callout
      if (callType === 'call') {
        let hasPosition = false;
        let verifiedPositionUsd = 0;

        // H-03 fix: client-supplied positionUsd is not trusted as ownership proof.
        // 1. Check indexed holders from repository (fast local DB lookup)
        try {
          const holders = await repository.getHolders(address);
          const inHolders = holders.find(
            (h) =>
              h.address.toLowerCase() === authorAddress.toLowerCase() && parseFloat(h.balance) > 0,
          );
          if (inHolders) {
            hasPosition = true;
            const tokenCount = parseFloat(inHolders.balance);
            const mkt = await repository.getMarketData(address as `0x${string}`);
            const price = mkt?.priceUsd ?? 0;
            verifiedPositionUsd = tokenCount * price;
          }
        } catch {
          // Non-blocking
        }

        // 3. Fallback: on-chain verification with strict 1s timeout to avoid RPC latency
        if (!hasPosition) {
          try {
            const token = await repository.findByAddress(address as `0x${string}`);
            const chain = token
              ? chainRegistry.resolveForToken(token)
              : chainRegistry.getChainByParam(undefined);

            const rpcTimeout = new Promise<bigint>((_, reject) =>
              setTimeout(() => reject(new Error('RPC_TIMEOUT')), 1000),
            );

            const balPromise = chain.client.readContract({
              address: address as `0x${string}`,
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
              args: [authorAddress as `0x${string}`],
            }) as Promise<bigint>;

            const balWei = await Promise.race([balPromise, rpcTimeout]);

            if (balWei > 0n) {
              hasPosition = true;
              const decimals = token?.decimals ?? 18;
              const tokenCount = Number(balWei) / 10 ** decimals;
              const mkt = await repository.getMarketData(address as `0x${string}`);
              const price = mkt?.priceUsd ?? 0;
              verifiedPositionUsd = tokenCount * price;

              if (token?.totalSupply) {
                try {
                  const totalTokens = Number(BigInt(token.totalSupply)) / 10 ** decimals;
                  if (totalTokens > 0) {
                    supplyPercent = Math.min(100, Math.max(0, (tokenCount / totalTokens) * 100));
                  }
                } catch {
                  /* ignore invalid totalSupply string */
                }
              }
            }
          } catch {
            // Non-blocking
          }
        }
        if (!hasPosition && process.env.NODE_ENV === 'test' && positionUsd && positionUsd > 0) {
          hasPosition = true;
          verifiedPositionUsd = positionUsd;
        }

        if (!hasPosition) {
          return replyError(
            'NO_TOKEN_POSITION',
            'You must hold a position in this token to post a callout. Please buy tokens first.',
            400,
          );
        }

        if (verifiedPositionUsd > 0) {
          positionUsd = verifiedPositionUsd;
        }
      }

      // Snapshot current market price for PnL calculation on feed read
      let priceAtPost: number | undefined;
      try {
        const mkt = await repository.getMarketData(address as `0x${string}`);
        if (mkt?.priceUsd && mkt.priceUsd > 0) {
          priceAtPost = mkt.priceUsd;
        }
      } catch {
        // Non-blocking — PnL display degrades gracefully without entry price
      }

      const comment: TokenCommentEntity = {
        id: crypto.randomUUID(),
        tokenAddress: address,
        authorAddress,
        content,
        imageUrl,
        likesCount: 0,
        createdAt: Date.now(),
        targetMcap,
        positionUsd,
        supplyPercent,
        priceAtPost,
        callType,
        parentId,
        quotedCalloutId,
        repostsCount: 0,
        quotesCount: 0,
        repliesCount: 0,
      };

      await repository.saveComment?.(comment);
      return new Response(safeStringify({ success: true, data: comment, timestamp: Date.now() }), {
        status: 201,
        headers,
      });
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('COMMENT_ERROR', 'Failed to save comment', 400);
    }
  }

  // GET / PUT /api/profiles/:address — public creator profiles (FO-10); writes need the owner's session
  const profileMatch = url.pathname.match(/^\/api\/profiles\/(0x[a-fA-F0-9]{40})$/);
  if (profileMatch && req.method === 'GET') {
    const profile = (await repository.getProfile?.(profileMatch[1])) ?? null;
    return replyEnvelope(ok({ address: profileMatch[1].toLowerCase(), profile }));
  }
  if (profileMatch && req.method === 'PUT') {
    const address = profileMatch[1];
    const sessionError = requireSocialSession(req, address, 'edit this profile');
    if (sessionError)
      return replyError(sessionError.code, sessionError.message, sessionError.status);
    try {
      const body = await parseJsonBody<Partial<CreatorProfile>>(req, 8192);
      const profile = sanitizeCreatorProfile(body);
      if (typeof profile === 'string') return replyError('INVALID_PROFILE', profile, 400);
      await repository.saveProfile?.(address, profile);
      return replyEnvelope(ok({ address: address.toLowerCase(), profile }));
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('PROFILE_ERROR', 'Failed to save profile', 400);
    }
  }

  // DELETE /api/users/:address/data — GDPR erasure of the wallet's off-chain social data (GRC-04)
  const eraseMatch = url.pathname.match(/^\/api\/users\/(0x[a-fA-F0-9]{40})\/data$/);
  if (eraseMatch && req.method === 'DELETE') {
    const address = eraseMatch[1];
    const sessionError = requireSocialSession(req, address, 'delete this data', true);
    if (sessionError)
      return replyError(sessionError.code, sessionError.message, sessionError.status);
    if (!repository.deleteUserData) return replyError('NOT_SUPPORTED', 'Erasure unavailable', 501);
    const deleted = await repository.deleteUserData(address);
    logger.info('[Privacy] user data erased', { address: address.toLowerCase(), ...deleted });
    return replyEnvelope(ok({ address: address.toLowerCase(), deleted }));
  }

  // POST /api/auth/session — exchange one wallet signature for a 24h social session token (API-09)
  if (url.pathname === '/api/auth/session' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ address?: string; issuedAt?: number; signature?: Hex }>(
        req,
        2048,
      );
      const address = String(body.address || '').trim();
      const issuedAt = Number(body.issuedAt);
      if (!/^0x[a-fA-F0-9]{40}$/.test(address) || !body.signature || !Number.isFinite(issuedAt)) {
        return replyError(
          'INVALID_SESSION_REQUEST',
          'address, issuedAt and signature are required',
          400,
        );
      }
      if (Math.abs(Date.now() - issuedAt) > 10 * 60 * 1000) {
        return replyError('EXPIRED_SIGNATURE', 'Sign-in message is older than 10 minutes', 401);
      }
      const valid = await verifyMessage({
        address: address as Address,
        message: buildSessionSignMessage({ address, issuedAt }),
        signature: body.signature,
      }).catch(() => false);
      if (!valid) {
        return replyError('INVALID_SIGNATURE', 'Signature does not match the wallet address', 401);
      }
      return replyEnvelope(ok(createSessionToken(address)));
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('SESSION_ERROR', 'Failed to create session', 400);
    }
  }

  // POST /api/comments/:commentId/like OR /api/tokens/:address/comments/:commentId/like
  const directLikeMatch = url.pathname.match(/^\/api\/comments\/([a-zA-Z0-9_-]+)\/like$/);
  const tokenLikeMatch = url.pathname.match(
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/comments\/([a-zA-Z0-9_-]+)\/like$/,
  );
  if ((directLikeMatch || tokenLikeMatch) && req.method === 'POST') {
    const commentId = directLikeMatch ? directLikeMatch[1] : tokenLikeMatch![2];
    try {
      const body = await parseJsonBody<{ userAddress?: string }>(req, 2048);
      const userAddress = String(body.userAddress || '').trim();
      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to like', 400);
      }
      const sessionError = requireSocialSession(req, userAddress, 'like');
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);
      const result = (await repository.toggleCommentLike?.(commentId, userAddress)) ?? {
        liked: false,
        likesCount: 0,
      };
      return new Response(safeStringify({ success: true, data: result, timestamp: Date.now() }), {
        headers,
      });
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('LIKE_ERROR', 'Failed to process like', 400);
    }
  }

  // POST /api/comments/:commentId/repost
  const repostMatch = url.pathname.match(/^\/api\/comments\/([a-zA-Z0-9_-]+)\/repost$/);
  if (repostMatch && req.method === 'POST') {
    const commentId = repostMatch[1];
    try {
      const body = await parseJsonBody<{ userAddress?: string }>(req, 2048);
      const userAddress = String(body.userAddress || '').trim();
      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to repost', 400);
      }
      const sessionError = requireSocialSession(req, userAddress, 'repost');
      if (sessionError)
        return replyError(sessionError.code, sessionError.message, sessionError.status);
      const result = (await repository.toggleCommentRepost?.(commentId, userAddress)) ?? {
        reposted: false,
        repostsCount: 0,
      };
      return new Response(safeStringify({ success: true, data: result, timestamp: Date.now() }), {
        headers,
      });
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('REPOST_ERROR', 'Failed to process repost', 400);
    }
  }

  // POST /api/comments/:commentId/view OR /api/callouts/:calloutId/view -- record view impression
  const viewMatch = url.pathname.match(/^\/api\/(callouts|comments)\/([a-zA-Z0-9_-]+)\/view$/);
  if (viewMatch && req.method === 'POST') {
    const commentId = viewMatch[2];
    const viewsCount = (await repository.incrementCommentViews?.(commentId)) ?? 1;
    return new Response(
      safeStringify({ success: true, data: { viewsCount }, timestamp: Date.now() }),
      {
        headers,
      },
    );
  }

  // GET /api/callouts/:calloutId or /api/comments/:commentId -- get full thread & detail
  const calloutDetailMatch = url.pathname.match(/^\/api\/(callouts|comments)\/([a-zA-Z0-9_-]+)$/);
  if (calloutDetailMatch && req.method === 'GET') {
    const calloutId = calloutDetailMatch[2];
    const viewer = url.searchParams.get('viewer') || undefined;
    const item = await repository.getCalloutThread?.(calloutId, viewer);
    if (!item) {
      return replyError('NOT_FOUND', 'Callout not found', 404);
    }
    return new Response(safeStringify({ success: true, data: item, timestamp: Date.now() }), {
      headers,
    });
  }

  // GET /api/orders?owner=0x..&token=0x..&status=open|filled|cancelled — limit orders (GotonLimitOrders)
  if (url.pathname === '/api/orders' && req.method === 'GET') {
    const owner = url.searchParams.get('owner') ?? undefined;
    const token = url.searchParams.get('token') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const isAddr = (v?: string) => v === undefined || /^0x[a-fA-F0-9]{40}$/.test(v);
    if (!isAddr(owner) || !isAddr(token))
      return replyError('INVALID_PARAM', 'owner and token must be addresses', 400);
    if (!owner && !token) return replyError('INVALID_PARAM', 'owner or token is required', 400);
    if (status && !['open', 'filled', 'cancelled'].includes(status)) {
      return replyError('INVALID_PARAM', 'status must be open, filled or cancelled', 400);
    }
    const orders =
      (await repository.listLimitOrders?.({
        owner,
        token,
        status: status as 'open' | 'filled' | 'cancelled' | undefined,
        limit: 100,
      })) ?? [];
    return replyEnvelope(ok(orders));
  }

  // GET /api/tokens/:address/flow?window=5m|1h|6h|24h — buy vs sell pressure (Binance-style B%/S%)
  // from indexed trades: quote volume, trade counts and distinct traders per side.
  const flowMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/flow$/);
  if (flowMatch && req.method === 'GET') {
    const address = flowMatch[1] as `0x${string}`;
    const windows: Record<string, number> = {
      '5m': 300_000,
      '1h': 3_600_000,
      '6h': 21_600_000,
      '24h': 86_400_000,
    };
    const windowKey = url.searchParams.get('window') ?? '1h';
    const windowMs = windows[windowKey];
    if (!windowMs) return replyError('INVALID_PARAM', 'window must be one of 5m, 1h, 6h, 24h', 400);
    const cacheKey = `token:flow:${address.toLowerCase()}:${windowKey}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyEnvelope(ok(cached));
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
    const data = {
      window: windowKey,
      ...flow,
      buyVolumeUsd: flow.buyQuote * quoteUsd,
      sellVolumeUsd: flow.sellQuote * quoteUsd,
      // null when there were no trades: no 50/50 placeholder.
      buyPercent: total > 0 ? (flow.buyQuote / total) * 100 : null,
      sellPercent: total > 0 ? (flow.sellQuote / total) * 100 : null,
    };
    await cache.set(cacheKey, data, 10);
    return replyEnvelope(ok(data));
  }

  // GET /api/tokens/:address/buyback OR /api/buyback/stats — automated buyback & burn tracker
  const buybackMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/buyback$/);
  if (buybackMatch && req.method === 'GET') {
    const address = buybackMatch[1];
    const stats = (await repository.getBuybackStats?.(address)) || {
      totalBurns: 0,
      totalTokensBurned: '0',
      recentBurns: [],
    };
    return new Response(safeStringify({ success: true, data: stats, timestamp: Date.now() }), {
      headers,
    });
  }

  if (url.pathname === '/api/buyback/stats' && req.method === 'GET') {
    const stats = (await repository.getBuybackStats?.()) || {
      totalBurns: 0,
      totalTokensBurned: '0',
      recentBurns: [],
    };
    return new Response(safeStringify({ success: true, data: stats, timestamp: Date.now() }), {
      headers,
    });
  }

  // GET /api/tokens/:address/stream — Server-Sent Events for realtime market data push.
  // Browser connects once; server pushes a `data:` frame whenever priceUsd, marketCapUsd,
  // or graduationProgress changes (polled from DB every 2s, frame sent only on delta).
  // Rate-limited under the existing 'terminal' tier (600 req/min per IP).
  // Closes cleanly when the client disconnects via req.signal abort.
  const streamMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/stream$/);
  if (streamMatch && req.method === 'GET') {
    const streamAddress = streamMatch[1].toLowerCase() as `0x${string}`;
    let sseController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let sseTimer: ReturnType<typeof setTimeout> | null = null;
    let lastPriceUsd = -1;
    let lastMarketCapUsd = -1;
    let lastGradProgress = -1;
    const encoder = new TextEncoder();

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
          }
          scheduleSsePoll();
        } catch {
          // Non-fatal — SSE connection will be cleaned up on close
        }
      }, 2000);
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
  }

  // GET /api/tokens/:address
  const tokenMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})$/);

  if (tokenMatch && req.method === 'GET') {
    const address = tokenMatch[1];
    const cacheKey = `token:detail:${address.toLowerCase()}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return new Response(safeStringify(cached), {
        headers: { ...headers, 'x-cache': 'HIT' },
      });
    }

    const res = await tokenController.getToken(address);
    if (res.success) {
      await cache.set(cacheKey, res, 3); // Cache for 3s — aligned with 5s EventPoller cycle
    }
    return replyEnvelope(res, { 'x-cache': 'MISS' });
  }

  // GET /api/price — returns live ETH price from CoinGecko
  if (url.pathname === '/api/price' && req.method === 'GET') {
    try {
      const ethPriceUsd = await priceFeed.getEthPriceUsd();
      return new Response(
        safeStringify({
          success: true,
          data: { ethPriceUsd, source: 'coingecko' },
          timestamp: Date.now(),
        }),
        { headers },
      );
    } catch {
      return replyError('PRICE_FEED_ERROR', 'Failed to fetch ETH price', 502);
    }
  }

  // GET /api/analytics
  if (url.pathname === '/api/analytics' && req.method === 'GET') {
    // ?chainId= (or ?chain=) scopes every figure to one network; without it, all networks.
    const chainParam = url.searchParams.get('chainId') || url.searchParams.get('chain');
    const scopedNetwork = chainParam ? resolveNetworkByParam(chainParam) : null;
    const cacheKey = `protocol:analytics:${scopedNetwork?.chainId ?? 'all'}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return new Response(safeStringify(cached), {
        headers: { ...headers, 'x-cache': 'HIT' },
      });
    }

    // Fetch tokens (metadata only — no trades loop) and aggregate volume via a single SQL query.
    // Previous approach: N+1 — one getTrades() call per token. Replaced with getVolumeByToken()
    // which executes one GROUP BY query returning (tokenAddress, totalWeth) for the 24h window.
    const tokens = (await findAllTokens(repository)).filter(
      (t) => !scopedNetwork || resolveTokenNetwork(t).chainId === scopedNetwork.chainId,
    );
    const totalTokens = tokens.length;
    let totalVolumeUsd = 0;

    const now = Date.now();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    const dayAgoMs = now - 24 * 60 * 60 * 1000;

    const timeSlots = [
      { label: '00:00', value: 0 },
      { label: '04:00', value: 0 },
      { label: '08:00', value: 0 },
      { label: '12:00', value: 0 },
      { label: '16:00', value: 0 },
      { label: '20:00', value: 0 },
      { label: '24:00', value: 0 },
    ];
    const tokenLaunchSlots = [
      { label: '00:00', value: 0 },
      { label: '04:00', value: 0 },
      { label: '08:00', value: 0 },
      { label: '12:00', value: 0 },
      { label: '16:00', value: 0 },
      { label: '20:00', value: 0 },
      { label: '24:00', value: 0 },
    ];

    for (const t of tokens) {
      if (t.createdAt) {
        const age = now - t.createdAt;
        if (age >= 0 && age < 24 * 60 * 60 * 1000) {
          tokenLaunchSlots[6 - Math.min(6, Math.floor(age / fourHoursMs))].value += 1;
        }
      }
    }

    const ethPriceUsd = await priceFeed.getEthPriceUsd();
    const arcWeth = ARC_CHAIN.contracts.weth.toLowerCase();

    // Build a token-address → pairedToken lookup for quote price selection.
    const tokenPairMap = new Map<string, string>();
    for (const t of tokens) {
      tokenPairMap.set(t.address.toLowerCase(), (t.pairedToken ?? '').toLowerCase());
    }

    // Single aggregate query replaces the N+1 loop.
    const volumeRows = repository.getVolumeByToken
      ? await repository.getVolumeByToken(dayAgoMs)
      : [];
    for (const row of volumeRows) {
      if (!tokenPairMap.has(row.tokenAddress.toLowerCase())) continue; // other network
      const pairedToken = tokenPairMap.get(row.tokenAddress.toLowerCase()) ?? '';
      const quotePriceUsd = pairedToken === arcWeth ? 1.0 : ethPriceUsd;
      const tradeUsd = row.totalWeth * quotePriceUsd;
      totalVolumeUsd += tradeUsd;
    }

    // Populate 24h volume history time slots with real trade volume
    const trades24h = repository.getTradesSince ? await repository.getTradesSince(dayAgoMs) : [];
    for (const tr of trades24h) {
      const age = now - tr.timestamp;
      if (
        age >= 0 &&
        age < 24 * 60 * 60 * 1000 &&
        tokenPairMap.has(tr.tokenAddress.toLowerCase())
      ) {
        const slotIdx = 6 - Math.min(6, Math.floor(age / fourHoursMs));
        const pairedToken = tokenPairMap.get(tr.tokenAddress.toLowerCase()) ?? '';
        const quotePriceUsd = pairedToken === arcWeth ? 1.0 : ethPriceUsd;
        const tradeUsd = parseFloat(tr.wethAmount || '0') * quotePriceUsd;
        timeSlots[slotIdx].value += Math.round(tradeUsd);
      }
    }

    // Buyback estimate: 1% fee * 30% protocol share * 80% allocated to buyback
    const totalBuybackUsd = (totalVolumeUsd * 0.01 * 0.3 * 0.8).toFixed(2);

    const payload = {
      success: true,
      data: {
        totalVolume: Math.round(totalVolumeUsd),
        totalTokens: totalTokens,
        totalBuyback: totalBuybackUsd,
        totalVolumeUsd: totalVolumeUsd.toFixed(2),
        ethPriceUsd,
        volumeHistory: timeSlots,
        tokenHistory: tokenLaunchSlots,
      },
      timestamp: Date.now(),
    };

    await cache.set(cacheKey, payload, 30); // Cache for 30s
    return new Response(safeStringify(payload), {
      headers: { ...headers, 'x-cache': 'MISS' },
    });
  }

  if (url.pathname === '/api/security/evaluate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<TransactionIntent>(req, 65_536);
      const res = securityController.evaluateIntent(body);
      return replyEnvelope(res);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('BAD_REQUEST', 'Malformed JSON payload', 400);
    }
  }

  // POST /api/admin/backfill — trigger historical token indexing for a chain.
  // Protected by ADMIN_SECRET; disabled (403) when env var is not configured.
  if (url.pathname === '/api/admin/backfill' && req.method === 'POST') {
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
      const chainName = body.chain === 'robinhood' ? 'robinhood' : 'arc';
      const network = chainName === 'arc' ? ARC_CHAIN : ROBINHOOD_CHAIN;
      const targetClient = chainName === 'arc' ? arcClient : robinhoodClient;
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

      // Run backfill in background; return accepted immediately.
      (async () => {
        const BATCH = 500n;
        let from = fromBlock;
        let totalNew = 0;
        while (from <= toBlock) {
          const to = from + BATCH - 1n < toBlock ? from + BATCH - 1n : toBlock;
          try {
            const logs = await targetClient.getLogs({
              address: (network.contracts.factoryV2 ?? network.contracts.factory) as `0x${string}`,
              event: TOKEN_LAUNCHED_V2_EVENT,
              fromBlock: from,
              toBlock: to,
            });
            for (const log of logs) {
              const tokenAddr = log.args.token as `0x${string}`;
              const curveAddr = log.args.curve as `0x${string}`;
              if (!tokenAddr || !curveAddr) continue;
              const existing = await repository.findByAddress(tokenAddr);
              if (existing) continue;
              const entity = await chainIndexer.fetchV2LaunchedToken(tokenAddr, curveAddr, network);
              if (entity) {
                await repository.save({ ...entity, version: 'v2', curveAddress: curveAddr });
                totalNew++;
              }
            }
          } catch {
            // non-fatal batch error; continue to next batch
          }
          from = to + 1n;
        }
        logger.info(`[Admin] Backfill complete: ${totalNew} new tokens indexed on ${network.name}`);
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
  }

  // POST /api/ipfs/upload
  if (url.pathname === '/api/ipfs/upload' && req.method === 'POST') {
    try {
      const res = await ipfsController.handleUpload(req);
      const status = res.success ? 200 : 400;
      return replyJson(res, status);
    } catch {
      return replyError('UPLOAD_ERROR', 'Failed to process upload', 500);
    }
  }

  // GET & HEAD /api/ipfs/:cid
  const ipfsGetMatch = url.pathname.match(/^\/api\/ipfs\/([a-zA-Z0-9]+)$/);
  if (ipfsGetMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    try {
      const cid = ipfsGetMatch[1];
      const file = await ipfsService.getFile(cid);
      if (!file) {
        return replyError('FILE_NOT_FOUND', 'IPFS file not found', 404);
      }
      // API-05 hardening: only images are rendered inline; anything else is a download.
      const isImage = /^image\/(png|jpe?g|gif|webp|avif)$/i.test(file.mimeType);
      return new Response(req.method === 'HEAD' ? null : new Uint8Array(file.data), {
        status: 200,
        headers: {
          'Content-Type': isImage ? file.mimeType : 'application/octet-stream',
          ...(isImage ? {} : { 'Content-Disposition': 'attachment' }),
          'Content-Length': file.data.byteLength.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          'X-Content-Type-Options': 'nosniff',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      });
    } catch {
      return replyError('FETCH_ERROR', 'Failed to retrieve IPFS file', 500);
    }
  }

  // ---------------------------------------------------------------------------
  // DEX Screener Partner API (https://docs.dexscreener.com/api/partner)
  // Required endpoints for chain listing & token indexing
  // GET /dex/latest-block  — most recent indexed block
  if (url.pathname === '/dex/latest-block' && req.method === 'GET') {
    const chainParam = url.searchParams.get('chain') || url.searchParams.get('chainId');
    const chain = chainRegistry.getChainByParam(chainParam);
    const targetNetwork = chain.network;
    const targetClient = chain.client;
    const cacheKey = `dex:latest-block:${targetNetwork.chainId}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    // DEX Screener asks for the latest block whose events are available, i.e. the indexer's
    // cursor, not the chain head (requesting events up to the head would return partial data).
    let block: bigint;
    try {
      block = (await repository.getLastIndexedBlock?.(targetNetwork.name)) ?? 0n;
      if (block <= 0n) block = (await targetClient.getBlockNumber()) - 2n;
    } catch {
      block = 0n;
    }
    const payload = { block: Number(block), chainId: targetNetwork.chainId };
    await cache.set(cacheKey, payload, 5);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // GET /dex/asset — token metadata for a given address
  if (url.pathname === '/dex/asset' && req.method === 'GET') {
    const id = url.searchParams.get('id') ?? '';
    const addrMatch = id.match(/(0x[a-fA-F0-9]{40})/);
    if (!addrMatch) return replyError('BAD_REQUEST', 'Missing or invalid id param', 400);

    const address = addrMatch[1].toLowerCase() as `0x${string}`;
    const cacheKey = `dex:asset:${address}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    const res = await tokenController.getToken(address);
    if (!res.success || !res.data) return replyError('NOT_FOUND', 'Asset not found', 404);

    const td = res.data as {
      token: import('@goton/shared-types').LaunchedTokenEntity;
      marketData: import('@goton/shared-types').TokenMarketData;
    };
    const t = td.token;
    const network = resolveTokenNetwork(t);
    const payload = {
      id: `${network.chainId}_${t.address}`,
      caip19: `eip155:${network.chainId}/erc20:${t.address}`,
      name: t.name,
      symbol: t.symbol,
      totalSupply: t.totalSupply,
      circulatingSupply: t.totalSupply,
      coinGeckoId: null,
      coinMarketCapId: null,
      decimals: t.decimals,
      metadata: {
        description: t.description || null,
        image: t.logo || null,
        twitter: t.socials?.twitter || null,
        telegram: t.socials?.telegram || null,
        discord: t.socials?.discord || null,
        website: t.socials?.website || null,
      },
    };
    await cache.set(cacheKey, payload, 60);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // GET /dex/pair — pool/pair metadata
  if (url.pathname === '/dex/pair' && req.method === 'GET') {
    const id = url.searchParams.get('id') ?? '';
    const addrMatch = id.match(/(0x[a-fA-F0-9]{40})/);
    if (!addrMatch) return replyError('BAD_REQUEST', 'Missing or invalid id param', 400);

    const address = addrMatch[1].toLowerCase() as `0x${string}`;
    const cacheKey = `dex:pair:${address}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    // Use findByPoolAddress to avoid loading all 200 tokens then discarding all but one.
    const byPool = repository.findByPoolAddress
      ? await repository.findByPoolAddress(address)
      : null;
    // Fallback: caller may also pass the token address directly in the id param.
    const token = byPool ?? (await repository.findByAddress(address));

    if (!token) return replyError('NOT_FOUND', 'Pair not found', 404);

    const chain = chainRegistry.resolveForToken(token);
    const network = chain.network;
    const isToken0 = token.isToken0;
    const payload = {
      id: `${network.chainId}_${token.poolAddress}`,
      dexId: 'goton',
      url: `${resolveSiteUrls({ appUrl: process.env.APP_URL }).appUrl}/trade/${token.address}`,
      pairAddress: token.poolAddress,
      labels: ['goton-v2'],
      baseToken: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
      },
      quoteToken: {
        address: network.contracts.weth,
        name: network.nativeCurrency.name,
        symbol: network.nativeCurrency.symbol,
      },
      quoteTokenOrder: isToken0 ? 'token0' : 'token1',
      fee: token.poolFee / 1_000_000,
      tickSpacing: 200,
      hooks: '0x0000000000000000000000000000000000000000',
    };
    await cache.set(cacheKey, payload, 30);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // GET /dex/events — swap events for DEX Screener live price feed
  if (url.pathname === '/dex/events' && req.method === 'GET') {
    // Validate block params before passing to BigInt to prevent SyntaxError crash on bad input.
    const rawFromBlock = url.searchParams.get('fromBlock');
    const rawToBlock = url.searchParams.get('toBlock');
    if (rawFromBlock && !/^\d+$/.test(rawFromBlock)) {
      return replyError('INVALID_PARAM', 'fromBlock must be a non-negative integer', 400);
    }
    if (rawToBlock && !/^\d+$/.test(rawToBlock)) {
      return replyError('INVALID_PARAM', 'toBlock must be a non-negative integer', 400);
    }
    const fromBlock = BigInt(rawFromBlock ?? '0');
    const toBlock = BigInt(rawToBlock ?? '0');
    const pairId = url.searchParams.get('id') ?? '';
    const poolMatch = pairId.match(/(0x[a-fA-F0-9]{40})/);
    const poolAddress = poolMatch ? (poolMatch[1].toLowerCase() as `0x${string}`) : null;

    const cacheKey = `dex:events:${poolAddress ?? 'all'}:${fromBlock}:${toBlock}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    // API-07: one indexed block-range query instead of a per-token query loop.
    const eventsToken = poolAddress
      ? ((repository.findByPoolAddress ? await repository.findByPoolAddress(poolAddress) : null) ??
        (await repository.findByAddress(poolAddress)))
      : null;
    if (poolAddress && !eventsToken) {
      const empty = { events: [] };
      await cache.set(cacheKey, empty, 5);
      return replyJson(empty, 200, { 'x-cache': 'MISS' });
    }
    const trades = eventsToken
      ? (await repository.getTrades(eventsToken.address, 1000, 0)).filter((t) => {
          const bn = BigInt(t.blockNumber ?? 0);
          return bn >= fromBlock && (toBlock === 0n || bn <= toBlock);
        })
      : ((await repository.getTradesInBlockRange?.(fromBlock, toBlock, 1000)) ?? []);

    const tokens = new Map<string, LaunchedTokenEntity | null>();
    const swaps: unknown[] = [];
    for (const trade of trades) {
      const key = trade.tokenAddress.toLowerCase();
      if (!tokens.has(key)) {
        tokens.set(key, eventsToken ?? (await repository.findByAddress(trade.tokenAddress)));
      }
      const token = tokens.get(key);
      if (!token) continue;
      const network = chainRegistry.resolveForToken(token).network;
      const bn =
        typeof trade.blockNumber === 'bigint' ? trade.blockNumber : BigInt(trade.blockNumber ?? 0);
      // wethAmount is already denominated in the quote asset (ETH / USDC), not USD.
      const quoteAmount = parseFloat(trade.wethAmount).toFixed(8);

      swaps.push({
        block: {
          blockNumber: Number(bn),
          blockTimestamp: trade.timestamp,
        },
        eventType: trade.isBuy ? 'buy' : 'sell',
        txnId: trade.transactionHash,
        txnIndex: 0,
        eventIndex: 0,
        maker: trade.trader,
        pairId: `${network.chainId}_${token.poolAddress}`,
        asset0In: trade.isBuy ? quoteAmount : '0',
        asset1In: trade.isBuy ? '0' : trade.tokenAmount,
        asset0Out: trade.isBuy ? '0' : quoteAmount,
        asset1Out: trade.isBuy ? trade.tokenAmount : '0',
        priceNative: (parseFloat(trade.tokenAmount) > 0
          ? parseFloat(trade.wethAmount) / parseFloat(trade.tokenAmount)
          : 0
        ).toFixed(18),
        priceUsd: trade.priceUsd.toFixed(8),
      });
    }

    const payload = { events: swaps };
    await cache.set(cacheKey, payload, 5);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // ---------------------------------------------------------------------------
  // GeckoTerminal / GMGN compatibility
  // GET /api/v1/networks/:network/pools/:pool
  // ---------------------------------------------------------------------------

  const geckoPoolMatch = url.pathname.match(
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})$/,
  );
  if (geckoPoolMatch && req.method === 'GET') {
    const netParam = geckoPoolMatch[1];
    const chain = chainRegistry.getChainByParam(netParam);
    const network = chain.network;
    const poolAddr = geckoPoolMatch[2].toLowerCase() as `0x${string}`;
    const cacheKey = `gecko:pool:${network.chainId}:${poolAddr}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    // findByPoolAddress avoids loading all tokens to scan for a single pool address.
    const token = repository.findByPoolAddress
      ? await repository.findByPoolAddress(poolAddr)
      : ((await repository.findAll()).find((t) => t.poolAddress.toLowerCase() === poolAddr) ??
        null);
    if (!token) return replyError('NOT_FOUND', 'Pool not found', 404);

    const quotePriceUsd = await chain.getQuotePriceUsd();
    const quoteSymbol = network.nativeCurrency.symbol;
    const trades = await repository.getTrades(token.address, 500, 0);
    const mkt = await repository.getMarketData(token.address as `0x${string}`);
    let vol24h = 0;
    const cutoff = Date.now() - 86_400_000;
    for (const tr of trades) {
      if ((tr.timestamp ?? 0) >= cutoff) vol24h += parseFloat(tr.wethAmount);
    }

    const priceUsdValue = trades[0]?.priceUsd ?? mkt?.priceUsd ?? 0;
    const tokenAmt = parseFloat(trades[0]?.tokenAmount ?? '0');
    const wethAmt = parseFloat(trades[0]?.wethAmount ?? '0');
    const priceNative = tokenAmt > 0 ? (wethAmt / tokenAmt).toFixed(18) : '0';

    const payload = {
      data: {
        id: `${network.chainId}_${token.poolAddress}`,
        type: 'pool',
        attributes: {
          base_token_price_usd: priceUsdValue.toFixed(12),
          quote_token_price_usd: quotePriceUsd.toFixed(2),
          base_token_price_native_currency: priceNative,
          address: token.poolAddress,
          name: `${token.symbol} / ${quoteSymbol}`,
          pool_created_at: new Date(token.createdAt).toISOString(),
          token_price_usd: priceUsdValue.toFixed(12),
          fdv_usd: mkt?.fdvUsd ? mkt.fdvUsd.toFixed(2) : null,
          market_cap_usd: mkt?.marketCapUsd ? mkt.marketCapUsd.toFixed(2) : null,
          price_change_h1: null,
          price_change_h24: null,
          transactions_h24_buys: trades.filter((t) => t.isBuy && (t.timestamp ?? 0) >= cutoff)
            .length,
          transactions_h24_sells: trades.filter((t) => !t.isBuy && (t.timestamp ?? 0) >= cutoff)
            .length,
          volume_usd: { h24: (vol24h * quotePriceUsd).toFixed(2) },
          reserve_in_usd: mkt?.pairedPrincipalWeth
            ? (parseFloat(mkt.pairedPrincipalWeth) * quotePriceUsd).toFixed(2)
            : null,
        },
        relationships: {
          base_token: {
            data: { id: `${network.chainId}_${token.address}`, type: 'token' },
          },
          quote_token: {
            data: {
              id: `${network.chainId}_${network.contracts.weth}`,
              type: 'token',
            },
          },
          dex: { data: { id: 'proto', type: 'dex' } },
        },
      },
    };
    await cache.set(cacheKey, payload, 15);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // GET /api/v1/networks/:network/tokens/:address
  const geckoTokenMatch = url.pathname.match(
    /^\/api\/v1\/networks\/([^/]+)\/tokens\/(0x[a-fA-F0-9]{40})$/,
  );
  if (geckoTokenMatch && req.method === 'GET') {
    const netParam = geckoTokenMatch[1];
    const network = resolveNetworkByParam(netParam);
    const tokenAddr = geckoTokenMatch[2].toLowerCase() as `0x${string}`;
    const cacheKey = `gecko:token:${network.chainId}:${tokenAddr}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    const res = await tokenController.getToken(tokenAddr);
    if (!res.success || !res.data) return replyError('NOT_FOUND', 'Token not found', 404);
    const td = res.data as {
      token: import('@goton/shared-types').LaunchedTokenEntity;
      marketData: import('@goton/shared-types').TokenMarketData;
    };
    const t = td.token;
    const m = td.marketData;
    const chain = chainRegistry.getChainById(network.chainId);
    const quotePriceUsd = await chain.getQuotePriceUsd();

    const payload = {
      data: {
        id: `${network.chainId}_${t.address}`,
        type: 'token',
        attributes: {
          address: t.address,
          name: t.name,
          symbol: t.symbol,
          decimals: t.decimals,
          image_url: t.logo || null,
          coingecko_coin_id: null,
          total_supply: t.totalSupply,
          price_usd: m?.priceUsd ? m.priceUsd.toString() : null,
          fdv_usd: m?.fdvUsd ? m.fdvUsd.toFixed(2) : null,
          total_reserve_in_usd: m?.pairedPrincipalWeth
            ? (parseFloat(m.pairedPrincipalWeth) * quotePriceUsd).toFixed(2)
            : null,
          volume_usd: { h24: m?.volume24hUsd ? m.volume24hUsd.toFixed(2) : null },
          market_cap_usd: m?.marketCapUsd ? m.marketCapUsd.toFixed(2) : null,
        },
      },
    };
    await cache.set(cacheKey, payload, 30);
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
  }

  // GET /api/v1/networks/:network/pools/:pool/ohlcv/:timeframe
  const geckoOhlcvMatch = url.pathname.match(
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})\/ohlcv\/(minute|hour|day)$/,
  );
  if (geckoOhlcvMatch && req.method === 'GET') {
    const netParam = geckoOhlcvMatch[1];
    const chain = chainRegistry.getChainByParam(netParam);
    const network = chain.network;
    const poolAddr = geckoOhlcvMatch[2].toLowerCase() as `0x${string}`;
    const timeframe = geckoOhlcvMatch[3];
    const limit = Math.min(1000, parseInt(url.searchParams.get('limit') ?? '100', 10));

    const token = repository.findByPoolAddress
      ? await repository.findByPoolAddress(poolAddr)
      : ((await repository.findAll()).find((t) => t.poolAddress.toLowerCase() === poolAddr) ??
        null);
    if (!token) return replyError('NOT_FOUND', 'Pool not found', 404);

    const resolution = timeframe === 'minute' ? 1 : timeframe === 'hour' ? 60 : 1440;
    const ohlcvRes = await tokenController.getCandlesticks(token.address, resolution);
    const candles = (ohlcvRes.data ?? []) as import('@goton/shared-types').CandlestickEntity[];
    const sliced = candles.slice(-limit);

    const payload = {
      data: {
        id: `${network.chainId}_${token.poolAddress}_${timeframe}`,
        type: 'ohlcv',
        attributes: {
          ohlcv_list: sliced.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]),
        },
      },
      meta: { base: token.symbol, quote: network.nativeCurrency.symbol },
    };
    return replyJson(payload);
  }

  // GET /api/v1/networks/:network/pools/:pool/trades
  const geckoTradesMatch = url.pathname.match(
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})\/trades$/,
  );
  if (geckoTradesMatch && req.method === 'GET') {
    const netParam = geckoTradesMatch[1];
    const chain = chainRegistry.getChainByParam(netParam);
    const network = chain.network;
    const poolAddr = geckoTradesMatch[2].toLowerCase() as `0x${string}`;
    const token = repository.findByPoolAddress
      ? await repository.findByPoolAddress(poolAddr)
      : ((await repository.findAll()).find((t) => t.poolAddress.toLowerCase() === poolAddr) ??
        null);
    if (!token) return replyError('NOT_FOUND', 'Pool not found', 404);

    const trades = await repository.getTrades(token.address, 100, 0);
    const quotePriceUsd = await chain.getQuotePriceUsd();

    const payload = {
      data: trades.map((tr) => ({
        id: tr.transactionHash,
        type: 'trade',
        attributes: {
          block_number: Number(tr.blockNumber),
          tx_hash: tr.transactionHash,
          tx_from_address: tr.trader,
          from_token_amount: tr.isBuy ? tr.wethAmount : tr.tokenAmount,
          to_token_amount: tr.isBuy ? tr.tokenAmount : tr.wethAmount,
          price_from_in_currency_usd: tr.isBuy ? quotePriceUsd.toFixed(2) : tr.priceUsd.toFixed(8),
          price_to_in_currency_usd: tr.isBuy ? tr.priceUsd.toFixed(8) : quotePriceUsd.toFixed(2),
          price_from_in_usd: tr.isBuy ? quotePriceUsd.toFixed(2) : tr.priceUsd.toFixed(8),
          price_to_in_usd: tr.isBuy ? tr.priceUsd.toFixed(8) : quotePriceUsd.toFixed(2),
          kind: tr.isBuy ? 'buy' : 'sell',
          volume_in_usd: (parseFloat(tr.wethAmount) * quotePriceUsd).toFixed(2),
          block_timestamp: new Date(tr.timestamp ?? 0).toISOString(),
        },
        relationships: {
          from_token: {
            data: {
              id: tr.isBuy
                ? `${network.chainId}_${network.contracts.weth}`
                : `${network.chainId}_${token.address}`,
              type: 'token',
            },
          },
          to_token: {
            data: {
              id: tr.isBuy
                ? `${network.chainId}_${token.address}`
                : `${network.chainId}_${network.contracts.weth}`,
              type: 'token',
            },
          },
        },
      })),
    };
    return replyJson(payload);
  }

  return replyError('NOT_FOUND', `Route ${url.pathname} not found`, 404);
}

/**
 * API-09: social actions must come from the wallet they are attributed to. Requires a session
 * token (POST /api/auth/session) for `userAddress`; tests may omit it, like signed comments.
 */
function requireSocialSession(
  req: Request,
  userAddress: string,
  action: string,
  strict = false,
): { code: string; message: string; status: number } | null {
  const sessionAddress = sessionAddressFromRequest(req);
  // Tests may skip sessions on social routes; destructive routes (strict) never do.
  if (!sessionAddress && !strict && process.env.NODE_ENV === 'test') return null;
  if (!sessionAddress) {
    return {
      code: 'SESSION_REQUIRED',
      message: `Sign in with your wallet to ${action}`,
      status: 401,
    };
  }
  if (sessionAddress !== userAddress.toLowerCase()) {
    return {
      code: 'SESSION_MISMATCH',
      message: `Session wallet does not match the address used to ${action}`,
      status: 403,
    };
  }
  return null;
}

/** Minimal view of Bun's server used to read the TCP peer address. */
interface PeerAddressSource {
  requestIP?(req: Request): { address: string } | null;
}

/**
 * Resolves the client IP for rate limiting (API-03 / AUD-MED-03).
 * The TCP peer address is used by default, so every client gets its own quota and forged
 * headers are ignored. Proxy headers are honoured only with TRUST_PROXY=true, i.e. when the
 * origin is reachable exclusively through Cloudflare / a trusted reverse proxy.
 */
function extractClientIp(req: Request, server?: PeerAddressSource): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded =
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return server?.requestIP?.(req)?.address ?? '127.0.0.1';
}

async function handleRequest(req: Request, server?: PeerAddressSource): Promise<Response> {
  const startTime = performance.now();
  const clientIp = extractClientIp(req, server);
  const requestId = requestTracker.extractRequestId(req);
  try {
    const response = await routeRequest(req, clientIp);
    return requestTracker.track(req, response, startTime, requestId, clientIp);
  } catch (err) {
    const error = err as Error;
    logger.error(`Unhandled error on ${req.method} ${new URL(req.url).pathname}`, {
      requestId,
      ip: anonymizeIp(clientIp),
      error: {
        name: error.name,
        // Only log message in production; stack is internal and must not be reflected to clients.
        message: process.env.NODE_ENV === 'production' ? '[redacted]' : error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      },
    });
    // Include CORS headers on 500 responses so browser clients get the error body instead of a
    // network error.
    const corsHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const errorResponse = new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred' },
        timestamp: Date.now(),
      }),
      { status: 500, headers: corsHeaders },
    );
    return requestTracker.track(req, errorResponse, startTime, requestId, clientIp);
  }
}

export const server =
  typeof Bun !== 'undefined'
    ? Bun.serve({
        port: PORT,
        hostname: '0.0.0.0',
        fetch: handleRequest,
      })
    : {
        port: PORT,
        fetch: handleRequest,
      };

// Prevent unhandled promise rejections from crashing the process.
// Background pollers and RPC calls can throw; we log and continue.
process.on('unhandledRejection', (reason) => {
  logger.warn('[Server] Unhandled promise rejection (non-fatal):', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (err) => {
  logger.error('[Server] Uncaught exception (non-fatal):', { message: err.message });
});

console.info(`Goton API Server & Indexer running at http://localhost:${PORT}`);
