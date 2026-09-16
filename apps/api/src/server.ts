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
} from './index';
import { createPublicClient, http, defineChain } from 'viem';
import { ROBINHOOD_CHAIN, TransactionIntent, ok, err } from '@proto/shared-types';

const chain = defineChain({
  id: ROBINHOOD_CHAIN.chainId,
  name: ROBINHOOD_CHAIN.name,
  nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
  rpcUrls: {
    default: { http: [ROBINHOOD_CHAIN.rpcUrl] },
  },
});

const publicClient = createPublicClient({
  chain,
  transport: http(ROBINHOOD_CHAIN.rpcUrl),
});

const PORT = parseInt(
  process.env.PORT ?? process.env.API_PORT ?? (process.env.NODE_ENV === 'test' ? '0' : '3001'),
  10,
);

const redisUrl =
  process.env.REDIS_URL ||
  (process.env.NODE_ENV === 'production' ? 'redis://redis:6379' : undefined);
const cache = new RedisCacheAdapter(redisUrl, logger);

const repository = new SqliteTokenRepository();
const chainIndexer = new ViemChainIndexerAdapter();
const priceFeed = new CoinGeckoPriceFeedAdapter({
  initialPrice: process.env.NODE_ENV === 'test' ? 2500 : undefined,
});
const calculatePricing = new CalculatePricingUseCase();
const getTokensUseCase = new GetTokensUseCase(repository);
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
const eventPoller = new EventPollerService(
  publicClient,
  repository,
  chainIndexer,
  calculatePricing,
  priceFeed,
);

const requestTracker = new HttpRequestTracker(logger, cache);
const devopsController = new DevopsController(requestTracker);

// M-06 fix: rate limiting backed by Redis for consistency across instances.
async function checkRateLimit(ip: string, limit = 120, windowMs = 60_000): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  try {
    const count = await cache.increment(key, windowMs);
    return count <= limit;
  } catch {
    logger.warn('Rate limit Redis unavailable, falling back to allow', { ip });
    return true;
  }
}

// Start background event poller worker loop
setInterval(async () => {
  try {
    await eventPoller.pollEvents();
  } catch {
    // Ignore background polling network errors
  }
}, 10000);

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
}

async function routeRequest(req: Request, clientIp: string): Promise<Response> {
  const url = new URL(req.url);

  // M-05 fix: restrict CORS to known origins instead of wildcard.
  // Populate CORS_ALLOWED_ORIGINS in the environment as a comma-separated list.
  // When the variable is absent every origin is allowed (development default).
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get('origin') || '';
  const corsOrigin =
    allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin)
      ? requestOrigin || '*'
      : '';

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

  // Rate Limiting on public/expensive API routes (120 req / minute per IP)
  // Healthcheck & root probe are exempt from rate limiting for monitoring availability
  const isHealthProbe = url.pathname === '/health' || url.pathname === '/';
  if (!isHealthProbe && !(await checkRateLimit(clientIp, 120, 60_000))) {
    return replyError('RATE_LIMIT_EXCEEDED', 'Too many requests, please slow down.', 429);
  }

  // DevOps Observability Dashboard & Telemetry Endpoints (Gated by DEVOPS_AUTH_TOKEN)
  const devopsToken = process.env.DEVOPS_AUTH_TOKEN;
  const isDevopsPath =
    url.pathname === '/devops' ||
    url.pathname === '/api/devops/telemetry' ||
    url.pathname === '/api/devops/metrics';

  if (isDevopsPath && devopsToken) {
    // I-03 fix: accept the secret only via the Authorization header.
    // Query-string tokens appear in server access logs and browser history.
    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (bearerToken !== devopsToken) {
      if (url.pathname === '/devops') {
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>401 Unauthorized - DevOps Gateway</title>
  <style>
    body { background: #121212; color: #ececec; font-family: ui-monospace, Menlo, monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1a1a1a; border: 1px solid #292929; border-radius: 12px; padding: 24px; max-width: 420px; text-align: center; }
    h1 { font-size: 18px; color: #ef4444; margin-bottom: 8px; }
    p { font-size: 13px; color: #888; line-height: 1.5; margin-bottom: 16px; }
    input { width: 100%; box-sizing: border-box; background: #121212; border: 1px solid #333; color: #fff; padding: 8px 12px; border-radius: 6px; font-family: inherit; font-size: 13px; margin-bottom: 12px; }
    button { width: 100%; background: #10b981; color: #000; font-weight: 700; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
  </style>
  <script>
    async function authenticate(e) {
      e.preventDefault();
      const token = document.getElementById('token-input').value;
      const res = await fetch('/devops', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) { document.open(); document.write(await res.text()); document.close(); }
      else { document.getElementById('err').textContent = 'Authentication failed.'; }
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
          error: {
            code: 'UNAUTHORIZED',
            message: 'Access denied. Valid DevOps token required.',
          },
        }),
        { status: 401, headers: { ...headers, 'WWW-Authenticate': 'Bearer realm="Proto DevOps"' } },
      );
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
  if (url.pathname === '/health' || url.pathname === '/') {
    const mem = process.memoryUsage();
    return new Response(
      safeStringify({
        status: 'ok',
        service: 'proto-api',
        uptime: Math.floor(process.uptime()),
        timestamp: Date.now(),
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        },
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
    const deployer = url.searchParams.get('deployer') ?? undefined;

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

  // GET /api/tokens/:address/trades
  const tradesMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/trades$/);
  if (tradesMatch && req.method === 'GET') {
    const address = tradesMatch[1];
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const res = await tokenController.getTrades(address, limit, offset);
    return new Response(safeStringify(res), { headers });
  }

  // GET /api/tokens/:address/holders
  const holdersMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/holders$/);
  if (holdersMatch && req.method === 'GET') {
    const address = holdersMatch[1];
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const res = await tokenController.getHolders(address, limit);
    return new Response(safeStringify(res), { headers });
  }

  // GET /api/tokens/:address/ohlcv
  const ohlcvMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/ohlcv$/);
  if (ohlcvMatch && req.method === 'GET') {
    const address = ohlcvMatch[1];
    const resolution = parseInt(url.searchParams.get('resolution') ?? '60', 10);
    const res = await tokenController.getCandlesticks(address, resolution);
    return new Response(safeStringify(res), { headers });
  }
  // GET /api/tokens/:address/top-traders
  const topTradersMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/top-traders$/);
  if (topTradersMatch && req.method === 'GET') {
    const address = topTradersMatch[1];
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const res = await tokenController.getTopTraders(address, limit);
    return new Response(safeStringify(res), { headers });
  }

  // GET /api/tokens/:address/dev-activity
  const devActivityMatch = url.pathname.match(/^\/api\/tokens\/(0x[a-fA-F0-9]{40})\/dev-activity$/);
  if (devActivityMatch && req.method === 'GET') {
    const address = devActivityMatch[1];
    const res = await tokenController.getDevActivity(address);
    return new Response(safeStringify(res), { headers });
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
    return new Response(safeStringify(res), {
      headers: { ...headers, 'x-cache': 'MISS' },
    });
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
    } catch (priceErr) {
      return replyError('PRICE_FEED_ERROR', (priceErr as Error).message, 502);
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

    const tokens = await repository.findAll();
    const totalTokens = tokens.length;
    let totalVolumeEth = 0;

    // Collect 24h bucketed data for reactive SVG chart (6 x 4-hour slots)
    const now = Date.now();
    const fourHoursMs = 4 * 60 * 60 * 1000;
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

    // Compute token creation timestamps
    for (const t of tokens) {
      if (t.createdAt) {
        const age = now - t.createdAt;
        if (age >= 0 && age < 24 * 60 * 60 * 1000) {
          const slotIdx = Math.min(6, Math.floor(age / fourHoursMs));
          tokenLaunchSlots[6 - slotIdx].value += 1;
        }
      }
    }

    const ethPriceUsd = await priceFeed.getEthPriceUsd();

    for (const t of tokens) {
      const trades = await repository.getTrades(t.address, 500, 0);
      for (const tr of trades) {
        const weth = parseFloat(tr.wethAmount || '0');
        totalVolumeEth += weth;

        if (tr.timestamp) {
          const age = now - tr.timestamp;
          if (age >= 0 && age < 24 * 60 * 60 * 1000) {
            const slotIdx = Math.min(6, Math.floor(age / fourHoursMs));
            const volumeUsd = Math.round(weth * ethPriceUsd);
            timeSlots[6 - slotIdx].value += volumeUsd;
          }
        }
      }
    }

    const totalVolumeUsd = Math.round(totalVolumeEth * ethPriceUsd);
    const totalBuybackEth = (totalVolumeEth * 0.01 * 0.3 * 0.8).toFixed(3); // 80% of 30% protocol fee

    const payload = {
      success: true,
      data: {
        totalVolume: totalVolumeUsd,
        totalTokens: totalTokens,
        totalBuyback: totalBuybackEth,
        totalVolumeEth: totalVolumeEth.toFixed(4),
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
      return replyJson(res);
    } catch {
      return replyError('BAD_REQUEST', 'Malformed JSON payload', 400);
    }
  }

  // POST /api/ipfs/upload
  if (url.pathname === '/api/ipfs/upload' && req.method === 'POST') {
    try {
      const res = await ipfsController.handleUpload(req);
      const status = res.success ? 200 : 400;
      return replyJson(res, status);
    } catch (err) {
      return replyError('UPLOAD_ERROR', (err as Error).message, 500);
    }
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
        message: error.message,
        stack: error.stack,
      },
    });
    const errorResponse = new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal error occurred',
        },
        timestamp: Date.now(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
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

console.info(`Proto API Server & Indexer running at http://localhost:${PORT}`);
