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
import { ROBINHOOD_CHAIN, TransactionIntent } from '@proto/shared-types';

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
const priceFeed = new CoinGeckoPriceFeedAdapter();
const calculatePricing = new CalculatePricingUseCase();
const getTokensUseCase = new GetTokensUseCase(repository);
const getTokenByAddressUseCase = new GetTokenByAddressUseCase(
  repository,
  chainIndexer,
  calculatePricing,
);
const tokenController = new TokenController(getTokensUseCase, getTokenByAddressUseCase, repository);

const securityGateService = new SecurityGateService();
const securityController = new SecurityController(securityGateService);

const ipfsService = new IpfsService();
const ipfsController = new IpfsController(ipfsService);
const eventPoller = new EventPollerService(
  publicClient,
  repository,
  chainIndexer,
  calculatePricing,
);

const requestTracker = new HttpRequestTracker(logger, cache);
const devopsController = new DevopsController(requestTracker);

const ipRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    ipRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
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
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // IP-based Rate Limiting (120 req / minute per IP)
  if (!checkRateLimit(clientIp, 120, 60_000)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please slow down.' },
      }),
      { status: 429, headers },
    );
  }

  // DevOps Observability Dashboard & Telemetry Endpoints (Gated by DEVOPS_AUTH_TOKEN)
  const devopsToken = process.env.DEVOPS_AUTH_TOKEN;
  const isDevopsPath =
    url.pathname === '/devops' ||
    url.pathname === '/api/devops/telemetry' ||
    url.pathname === '/api/devops/metrics';

  if (isDevopsPath && devopsToken) {
    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const queryToken = url.searchParams.get('token') || '';

    if (bearerToken !== devopsToken && queryToken !== devopsToken) {
      if (url.pathname === '/devops') {
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>401 Unauthorized · DevOps Gateway</title>
  <style>
    body { background: #121212; color: #ececec; font-family: ui-monospace, Menlo, monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1a1a1a; border: 1px solid #292929; border-radius: 12px; padding: 24px; max-width: 420px; text-align: center; }
    h1 { font-size: 18px; color: #ef4444; margin-bottom: 8px; }
    p { font-size: 13px; color: #888; line-height: 1.5; margin-bottom: 16px; }
    input { width: 100%; box-sizing: border-box; background: #121212; border: 1px solid #333; color: #fff; padding: 8px 12px; border-radius: 6px; font-family: inherit; font-size: 13px; margin-bottom: 12px; }
    button { width: 100%; background: #10b981; color: #000; font-weight: 700; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
    button:hover { background: #34d399; }
  </style>
</head>
<body>
  <div class="card">
    <h1>DevOps Authentication Required</h1>
    <p>This telemetry dashboard is restricted to authorized DevOps engineers. Please enter your secret token.</p>
    <form onsubmit="event.preventDefault(); window.location.href = '/devops?token=' + encodeURIComponent(document.getElementById('token-input').value);">
      <input type="password" id="token-input" placeholder="Enter DEVOPS_AUTH_TOKEN..." required autofocus />
      <button type="submit">Authenticate Dashboard</button>
    </form>
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
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed for /api/tokens' },
        }),
        { status: 405, headers: { ...headers, Allow: 'GET' } },
      );
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
      return new Response(safeStringify(cached), {
        headers: { ...headers, 'x-cache': 'HIT' },
      });
    }

    const res = await tokenController.listTokens(limit, offset, version, deployer);
    if (res.success) {
      await cache.set(cacheKey, res, 10); // Cache for 10s
    }
    return new Response(safeStringify(res), {
      headers: { ...headers, 'x-cache': 'MISS' },
    });
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
    for (const t of tokens) {
      const trades = await repository.getTrades(t.address, 500, 0);
      for (const tr of trades) {
        totalVolumeEth += parseFloat(tr.wethAmount || '0');
      }
    }
    const ethPriceUsd = await priceFeed.getEthPriceUsd();
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
      return new Response(safeStringify(res), { headers });
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'BAD_REQUEST', message: 'Malformed JSON payload' },
          timestamp: Date.now(),
        }),
        { status: 400, headers },
      );
    }
  }

  // POST /api/ipfs/upload
  if (url.pathname === '/api/ipfs/upload' && req.method === 'POST') {
    try {
      const res = await ipfsController.handleUpload(req);
      const status = res.success ? 200 : 400;
      return new Response(safeStringify(res), { status, headers });
    } catch (err) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'UPLOAD_ERROR', message: (err as Error).message },
          timestamp: Date.now(),
        }),
        { status: 500, headers },
      );
    }
  }

  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: `Route ${url.pathname} not found` },
      timestamp: Date.now(),
    }),
    { status: 404, headers },
  );
}

async function handleRequest(req: Request): Promise<Response> {
  const startTime = performance.now();
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
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
