import crypto from 'crypto';
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
import { createPublicClient, http, defineChain, type PublicClient } from 'viem';
import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  type NetworkConfig,
  TransactionIntent,
  type TokenCommentEntity,
  ok,
  err,
} from '@proto/shared-types';

function createClientForNetwork(cfg: NetworkConfig) {
  const c = defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: {
      default: { http: [cfg.rpcUrl] },
    },
  });
  return createPublicClient({
    chain: c,
    // retryCount=0: polling errors are already caught in try/catch blocks;
    // viem default retry=3 with backoff causes CPU spikes on reverted calls.
    transport: http(cfg.rpcUrl, { retryCount: 0, timeout: 10_000 }),
  });
}

export const robinhoodClient: PublicClient = createClientForNetwork(ROBINHOOD_CHAIN);
export const arcClient: PublicClient = createClientForNetwork(ARC_CHAIN);
export const publicClient: PublicClient = robinhoodClient; // Backward compatibility alias

const PORT = parseInt(
  process.env.PORT ?? process.env.API_PORT ?? (process.env.NODE_ENV === 'test' ? '0' : '3001'),
  10,
);

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
);
const tokenController = new TokenController(
  getTokensUseCase,
  getTokenByAddressUseCase,
  repository,
  priceFeed,
);

const securityGateService = new SecurityGateService();
const securityController = new SecurityController(securityGateService);

const ipfsService = new IpfsService();
const ipfsController = new IpfsController(ipfsService);

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
  tier: 'api' | 'crawler' | 'upload' = 'api',
): Promise<boolean> {
  const key = `ratelimit:${tier}:${ip}`;
  try {
    const count = await cache.increment(key, windowMs);
    return count <= limit;
  } catch {
    // Redis unavailable: fall through to in-memory counter so rate limiting still applies.
    logger.warn('Rate limit Redis unavailable, using in-memory fallback', { ip });
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
// 60-second interval: one block ~2s on Robinhood/Arc so 60s = ~30 blocks missed max.
// Chains are staggered by 5s to avoid simultaneous RPC bursts.
// Poller loops use recursive setTimeout so a slow RPC cycle cannot overlap the next one.
// A boolean lock prevents concurrent executions if setTimeout fires while the previous run
// is still active (should not happen with recursive pattern, but guards against edge cases).
let robinhoodPolling = false;
function scheduleRobinhoodPoll(): void {
  setTimeout(async () => {
    if (!robinhoodPolling) {
      robinhoodPolling = true;
      try {
        await robinhoodPoller.pollEvents();
      } catch {
        /* non-fatal */
      } finally {
        robinhoodPolling = false;
      }
    }
    scheduleRobinhoodPoll();
  }, 60_000);
}
let arcPolling = false;
function scheduleArcPoll(): void {
  setTimeout(async () => {
    if (!arcPolling) {
      arcPolling = true;
      try {
        await arcPoller.pollEvents();
      } catch {
        /* non-fatal */
      } finally {
        arcPolling = false;
      }
    }
    scheduleArcPoll();
  }, 60_000);
}
scheduleRobinhoodPoll();
// Stagger Arc chain by 5s to avoid simultaneous RPC bursts
setTimeout(scheduleArcPoll, 5_000);

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
}

async function routeRequest(req: Request, clientIp: string): Promise<Response> {
  const url = new URL(req.url);

  // M-05 fix: restrict CORS to known origins instead of wildcard.
  // Public crawler endpoints (/dex/*, /api/v1/*) always allow wildcard CORS (*)
  // so external aggregators (DEX Screener, GeckoTerminal, GMGN) are never blocked (Fix H-3).
  const isPublicCrawlerPath =
    url.pathname.startsWith('/dex/') || url.pathname.startsWith('/api/v1/');

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get('origin') || '';

  let corsOrigin = '';
  if (isPublicCrawlerPath) {
    // Public aggregator routes: open to all origins by spec requirement
    corsOrigin = '*';
  } else if (allowedOrigins.length > 0) {
    // Production: only reflect origin if it is in the explicit allow-list
    corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : '';
  } else {
    // No allow-list configured: permit localhost origins only (development)
    corsOrigin =
      requestOrigin.startsWith('http://localhost:') || requestOrigin.startsWith('http://127.0.0.1:')
        ? requestOrigin
        : '';
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

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

  // Rate Limiting: 120 req / minute per IP for standard routes, 600 req / minute for DEX crawlers (Fix H-2).
  // Healthcheck & root probe are exempt from rate limiting for monitoring availability.

  // Helper: convert an ApiEnvelope to the correct HTTP status code.
  // Controllers return envelopes with success:false but no HTTP status — derive it here.
  const envelopeStatus = (env: { success: boolean; error?: { code?: string } | null }): number => {
    if (env.success) return 200;
    const code = env.error?.code ?? '';
    if (code === 'TOKEN_NOT_FOUND' || code === 'INVALID_ADDRESS' || code === 'NOT_FOUND')
      return 404;
    if (code === 'INVALID_INPUT' || code === 'INVALID_INTENT' || code === 'VALIDATION_ERROR')
      return 400;
    return 500;
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
  // Upload endpoints get a tighter per-IP bucket to prevent OOM from concurrent large uploads.
  const isUploadPath = url.pathname === '/api/ipfs/upload';
  const rateTier = isPublicCrawlerPath ? 'crawler' : isUploadPath ? 'upload' : 'api';
  const maxRequests = isPublicCrawlerPath ? 600 : isUploadPath ? 10 : 120;
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
    // In production, fail-closed: if DEVOPS_AUTH_TOKEN is not configured, endpoints are disabled.
    if (!devopsToken && process.env.NODE_ENV === 'production') {
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
          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'nonce-devops1'; style-src 'nonce-devops1'">
  <title>401 Unauthorized - DevOps Gateway</title>
  <style nonce="devops1">
    body { background: #121212; color: #ececec; font-family: ui-monospace, Menlo, monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1a1a1a; border: 1px solid #292929; border-radius: 12px; padding: 24px; max-width: 420px; text-align: center; }
    h1 { font-size: 18px; color: #ef4444; margin-bottom: 8px; }
    p { font-size: 13px; color: #888; line-height: 1.5; margin-bottom: 16px; }
    input { width: 100%; box-sizing: border-box; background: #121212; border: 1px solid #333; color: #fff; padding: 8px 12px; border-radius: 6px; font-family: inherit; font-size: 13px; margin-bottom: 12px; }
    button { width: 100%; background: #10b981; color: #000; font-weight: 700; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
  </style>
  <script nonce="devops1">
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
                'WWW-Authenticate': 'Bearer realm="Proto DevOps"',
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
            headers: { ...headers, 'WWW-Authenticate': 'Bearer realm="Proto DevOps"' },
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
        service: 'proto-api',
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

  // GET /api/trades (global recent protocol trades)
  if (url.pathname === '/api/trades' && req.method === 'GET') {
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10)));
    const cacheKey = `protocol:trades:recent:${limit}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return replyJson(cached, 200, { 'x-cache': 'HIT' });
    }

    const recentTrades = repository.getRecentTrades ? await repository.getRecentTrades(limit) : [];
    const payload = ok(recentTrades);
    await cache.set(cacheKey, payload, 5); // 5s cache
    return replyJson(payload, 200, { 'x-cache': 'MISS' });
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
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10));
    const res = await tokenController.getTrades(address, limit, offset);
    return replyEnvelope(res);
  }

  // GET /api/tokens/:address/holders
  const holdersMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/holders$/);
  if (holdersMatch && req.method === 'GET') {
    const address = holdersMatch[1];
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const res = await tokenController.getHolders(address, limit);
    return replyEnvelope(res);
  }

  // GET /api/tokens/:address/ohlcv
  const ohlcvMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/ohlcv$/);
  if (ohlcvMatch && req.method === 'GET') {
    const address = ohlcvMatch[1];
    const resolution = parseInt(url.searchParams.get('resolution') ?? '60', 10);
    const fillGaps = url.searchParams.get('fillGaps') !== 'false';
    const res = await tokenController.getCandlesticks(address, resolution, fillGaps);
    return replyEnvelope(res);
  }
  // GET /api/tokens/:address/top-traders
  const topTradersMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/top-traders$/);
  if (topTradersMatch && req.method === 'GET') {
    const address = topTradersMatch[1];
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
    const res = await tokenController.getTopTraders(address, limit);
    return replyEnvelope(res);
  }

  // GET /api/tokens/:address/dev-activity
  const devActivityMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/dev-activity$/);
  if (devActivityMatch && req.method === 'GET') {
    const address = devActivityMatch[1];
    const res = await tokenController.getDevActivity(address);
    return replyEnvelope(res);
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
      const body = (await req.json()) as {
        content?: string;
        authorAddress?: string;
        imageUrl?: string;
      };
      const content = String(body.content || '').trim();
      const authorAddress = String(body.authorAddress || '').trim();
      const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : undefined;
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

      const comment: TokenCommentEntity = {
        id: crypto.randomUUID(),
        tokenAddress: address,
        authorAddress,
        content,
        imageUrl,
        likesCount: 0,
        createdAt: Date.now(),
      };

      await repository.saveComment?.(comment);
      return new Response(safeStringify({ success: true, data: comment, timestamp: Date.now() }), {
        status: 201,
        headers,
      });
    } catch {
      return replyError('COMMENT_ERROR', 'Failed to save comment', 500);
    }
  }

  // POST /api/tokens/:address/comments/:commentId/like
  const commentLikeMatch = url.pathname.match(
    /^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/comments\/([^/]+)\/like$/,
  );
  if (commentLikeMatch && req.method === 'POST') {
    const commentId = commentLikeMatch[2];
    try {
      const body = (await req.json()) as { userAddress?: string };
      const userAddress = String(body.userAddress || '').trim();
      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to like', 400);
      }
      const result = (await repository.toggleCommentLike?.(commentId, userAddress)) ?? {
        liked: false,
        likesCount: 0,
      };
      return new Response(safeStringify({ success: true, data: result, timestamp: Date.now() }), {
        headers,
      });
    } catch {
      return replyError('LIKE_ERROR', 'Failed to process like', 500);
    }
  }

  // GET & POST /api/tokens/:address/votes (or /vote)
  const votesMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/votes?$/);
  if (votesMatch && req.method === 'GET') {
    const address = votesMatch[1];
    const viewer = url.searchParams.get('viewer') || undefined;
    const summary = (await repository.getVotes?.(address, viewer)) || {
      tokenAddress: address,
      bullishCount: 0,
      bearishCount: 0,
      totalVotes: 0,
      bullishPercent: 50,
    };
    return new Response(safeStringify({ success: true, data: summary, timestamp: Date.now() }), {
      headers,
    });
  }

  if (votesMatch && req.method === 'POST') {
    const address = votesMatch[1];
    try {
      const body = (await req.json()) as { userAddress?: string; voteType?: string };
      const userAddress = String(body.userAddress || '').trim();
      const voteType = String(body.voteType || '').toLowerCase();
      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return replyError('INVALID_ADDRESS', 'Valid Ethereum address required to vote', 400);
      }
      if (voteType !== 'bullish' && voteType !== 'bearish') {
        return replyError('INVALID_VOTE', 'Vote type must be "bullish" or "bearish"', 400);
      }
      await repository.saveVote?.(address, userAddress, voteType as 'bullish' | 'bearish');
      const summary = await repository.getVotes?.(address, userAddress);
      return new Response(safeStringify({ success: true, data: summary, timestamp: Date.now() }), {
        headers,
      });
    } catch {
      return replyError('VOTE_ERROR', 'Failed to record vote', 500);
    }
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
      await cache.set(cacheKey, res, 15); // Cache for 15s
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
    const cacheKey = 'protocol:analytics';
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return new Response(safeStringify(cached), {
        headers: { ...headers, 'x-cache': 'HIT' },
      });
    }

    // Fetch tokens (metadata only — no trades loop) and aggregate volume via a single SQL query.
    // Previous approach: N+1 — one getTrades() call per token. Replaced with getVolumeByToken()
    // which executes one GROUP BY query returning (tokenAddress, totalWeth) for the 24h window.
    const tokens = await repository.findAll();
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
      const pairedToken = tokenPairMap.get(row.tokenAddress.toLowerCase()) ?? '';
      const quotePriceUsd = pairedToken === arcWeth ? 1.0 : ethPriceUsd;
      const tradeUsd = row.totalWeth * quotePriceUsd;
      totalVolumeUsd += tradeUsd;
      // Volume-by-slot bucketing is approximate at this level (per-token total, not per-trade ts).
      // Full per-trade slot detail requires a separate GROUP BY timestamp bucket query if needed.
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
      const body = (await req.json()) as TransactionIntent;
      const res = securityController.evaluateIntent(body);
      return replyEnvelope(res);
    } catch {
      return replyError('BAD_REQUEST', 'Malformed JSON payload', 400);
    }
  }

  // POST /api/admin/backfill — trigger historical token indexing for a chain.
  // Protected by ADMIN_SECRET env var; disabled if not set.
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
      const body = (await req.json()) as {
        chain?: string;
        fromBlock?: number | string;
        toBlock?: number | string;
      };
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
    } catch {
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

  // ---------------------------------------------------------------------------
  // DEX Screener Partner API (https://docs.dexscreener.com/api/partner)
  // Required endpoints for chain listing & token indexing
  // ---------------------------------------------------------------------------

  function resolveNetworkForToken(token: {
    pairedToken?: string;
    poolAddress?: string;
  }): NetworkConfig {
    if (
      token.pairedToken?.toLowerCase() === ARC_CHAIN.contracts.weth.toLowerCase() ||
      token.poolAddress?.toLowerCase() === ARC_CHAIN.contracts.factory.toLowerCase()
    ) {
      return ARC_CHAIN;
    }
    return ROBINHOOD_CHAIN;
  }

  function resolveNetworkByParam(param?: string | null): NetworkConfig {
    const p = (param || '').toLowerCase();
    if (p === 'arc' || p === '5042') return ARC_CHAIN;
    return ROBINHOOD_CHAIN;
  }

  // GET /dex/latest-block  — most recent indexed block
  if (url.pathname === '/dex/latest-block' && req.method === 'GET') {
    const chainParam = url.searchParams.get('chain') || url.searchParams.get('chainId');
    const targetNetwork = resolveNetworkByParam(chainParam);
    const targetClient = targetNetwork.chainId === ARC_CHAIN.chainId ? arcClient : robinhoodClient;
    const cacheKey = `dex:latest-block:${targetNetwork.chainId}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    let block: bigint;
    try {
      block = await targetClient.getBlockNumber();
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
      token: import('@proto/shared-types').LaunchedTokenEntity;
      marketData: import('@proto/shared-types').TokenMarketData;
    };
    const t = td.token;
    const network = resolveNetworkForToken(t);
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

    const network = resolveNetworkForToken(token);
    const isArc = network.chainId === ARC_CHAIN.chainId;
    const isToken0 = token.isToken0;
    const payload = {
      id: `${network.chainId}_${token.poolAddress}`,
      dexId: 'proto',
      url: `https://proto.fun/trade/${token.address}`,
      pairAddress: token.poolAddress,
      labels: ['proto-v2'],
      baseToken: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
      },
      quoteToken: {
        address: network.contracts.weth,
        name: isArc ? 'USD Coin' : 'Wrapped Ether',
        symbol: isArc ? 'USDC' : 'WETH',
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

    // Use findByPoolAddress when a specific pool id is requested to avoid the 200-token cap.
    const eventsToken = poolAddress
      ? ((repository.findByPoolAddress ? await repository.findByPoolAddress(poolAddress) : null) ??
        (await repository.findByAddress(poolAddress)))
      : null;
    const allTokens = poolAddress ? (eventsToken ? [eventsToken] : []) : await repository.findAll();
    const ethPriceUsd = await priceFeed.getEthPriceUsd();

    const swaps: unknown[] = [];

    for (const token of allTokens) {
      if (poolAddress && token.poolAddress.toLowerCase() !== poolAddress) continue;

      const network = resolveNetworkForToken(token);
      const isArc = network.chainId === ARC_CHAIN.chainId;
      const quotePriceUsd = isArc ? 1.0 : ethPriceUsd;

      const trades = await repository.getTrades(token.address, 100, 0);
      for (const trade of trades) {
        const bn =
          typeof trade.blockNumber === 'bigint'
            ? trade.blockNumber
            : BigInt(trade.blockNumber ?? 0);
        if (fromBlock > 0n && bn < fromBlock) continue;
        if (toBlock > 0n && bn > toBlock) continue;

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
          asset0In: trade.isBuy ? (parseFloat(trade.wethAmount) / quotePriceUsd).toFixed(8) : '0',
          asset1In: trade.isBuy ? '0' : trade.tokenAmount,
          asset0Out: trade.isBuy ? '0' : (parseFloat(trade.wethAmount) / quotePriceUsd).toFixed(8),
          asset1Out: trade.isBuy ? trade.tokenAmount : '0',
          priceNative: (parseFloat(trade.wethAmount) / parseFloat(trade.tokenAmount)).toFixed(18),
          priceUsd: trade.priceUsd.toFixed(8),
        });
      }
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
    const network = resolveNetworkByParam(netParam);
    const isArc = network.chainId === ARC_CHAIN.chainId;
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

    const quotePriceUsd = isArc ? 1.0 : await priceFeed.getEthPriceUsd();
    const quoteSymbol = isArc ? 'USDC' : 'WETH';
    const trades = await repository.getTrades(token.address, 500, 0);
    let vol24h = 0;
    const cutoff = Date.now() - 86_400_000;
    for (const tr of trades) {
      if ((tr.timestamp ?? 0) >= cutoff) vol24h += parseFloat(tr.wethAmount);
    }

    const payload = {
      data: {
        id: `${network.chainId}_${token.poolAddress}`,
        type: 'pool',
        attributes: {
          base_token_price_usd: (trades[0]?.priceUsd ?? 0).toFixed(12),
          quote_token_price_usd: quotePriceUsd.toFixed(2),
          base_token_price_native_currency: (
            parseFloat(trades[0]?.wethAmount ?? '0') / parseFloat(trades[0]?.tokenAmount ?? '1')
          ).toFixed(18),
          address: token.poolAddress,
          name: `${token.symbol} / ${quoteSymbol}`,
          pool_created_at: new Date(token.createdAt).toISOString(),
          token_price_usd: (trades[0]?.priceUsd ?? 0).toFixed(12),
          fdv_usd: null,
          market_cap_usd: null,
          price_change_h1: null,
          price_change_h24: null,
          transactions_h24_buys: trades.filter((t) => t.isBuy && (t.timestamp ?? 0) >= cutoff)
            .length,
          transactions_h24_sells: trades.filter((t) => !t.isBuy && (t.timestamp ?? 0) >= cutoff)
            .length,
          volume_usd: { h24: (vol24h * quotePriceUsd).toFixed(2) },
          reserve_in_usd: null,
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
      token: import('@proto/shared-types').LaunchedTokenEntity;
      marketData: import('@proto/shared-types').TokenMarketData;
    };
    const t = td.token;

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
          price_usd: null,
          fdv_usd: null,
          total_reserve_in_usd: null,
          volume_usd: { h24: null },
          market_cap_usd: null,
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
    const network = resolveNetworkByParam(netParam);
    const isArc = network.chainId === ARC_CHAIN.chainId;
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
    const candles = (ohlcvRes.data ?? []) as import('@proto/shared-types').CandlestickEntity[];
    const sliced = candles.slice(-limit);

    const payload = {
      data: {
        id: `${network.chainId}_${token.poolAddress}_${timeframe}`,
        type: 'ohlcv',
        attributes: {
          ohlcv_list: sliced.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]),
        },
      },
      meta: { base: token.symbol, quote: isArc ? 'USDC' : 'WETH' },
    };
    return replyJson(payload);
  }

  // GET /api/v1/networks/:network/pools/:pool/trades
  const geckoTradesMatch = url.pathname.match(
    /^\/api\/v1\/networks\/([^/]+)\/pools\/(0x[a-fA-F0-9]{40})\/trades$/,
  );
  if (geckoTradesMatch && req.method === 'GET') {
    const netParam = geckoTradesMatch[1];
    const network = resolveNetworkByParam(netParam);
    const isArc = network.chainId === ARC_CHAIN.chainId;
    const poolAddr = geckoTradesMatch[2].toLowerCase() as `0x${string}`;
    const token = repository.findByPoolAddress
      ? await repository.findByPoolAddress(poolAddr)
      : ((await repository.findAll()).find((t) => t.poolAddress.toLowerCase() === poolAddr) ??
        null);
    if (!token) return replyError('NOT_FOUND', 'Pool not found', 404);

    const trades = await repository.getTrades(token.address, 100, 0);
    const quotePriceUsd = isArc ? 1.0 : await priceFeed.getEthPriceUsd();

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

async function handleRequest(req: Request): Promise<Response> {
  const startTime = performance.now();
  const clientIp =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';
  const requestId = requestTracker.extractRequestId(req);

  try {
    const response = await routeRequest(req, clientIp);
    return requestTracker.track(req, response, startTime, requestId, clientIp);
  } catch (err) {
    const error = err as Error;
    logger.error(`Unhandled error on ${req.method} ${new URL(req.url).pathname}`, {
      requestId,
      ip: clientIp,
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

console.info(`Proto API Server & Indexer running at http://localhost:${PORT}`);
