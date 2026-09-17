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
import { createPublicClient, http, defineChain, type PublicClient } from 'viem';
import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  type NetworkConfig,
  TransactionIntent,
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
    transport: http(cfg.rpcUrl),
  });
}

export const robinhoodClient: PublicClient = createClientForNetwork(ROBINHOOD_CHAIN);
export const arcClient: PublicClient = createClientForNetwork(ARC_CHAIN);
export const publicClient: PublicClient = robinhoodClient; // Backward compatibility alias

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

// Start background event poller worker loop for both Robinhood and Arc chains
setInterval(async () => {
  try {
    await Promise.allSettled([robinhoodPoller.pollEvents(), arcPoller.pollEvents()]);
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
  // Public crawler endpoints (/dex/*, /api/v1/*) always allow wildcard CORS (*)
  // so external aggregators (DEX Screener, GeckoTerminal, GMGN) are never blocked (Fix H-3).
  const isPublicCrawlerPath =
    url.pathname.startsWith('/dex/') || url.pathname.startsWith('/api/v1/');

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get('origin') || '';
  const corsOrigin = isPublicCrawlerPath
    ? '*'
    : allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin)
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

  // Rate Limiting: 120 req / minute per IP for standard routes, 600 req / minute for DEX crawlers (Fix H-2).
  // Healthcheck & root probe are exempt from rate limiting for monitoring availability.
  const isHealthProbe = url.pathname === '/health' || url.pathname === '/';
  const maxRequests = isPublicCrawlerPath ? 600 : 120;
  if (!isHealthProbe && !(await checkRateLimit(clientIp, maxRequests, 60_000))) {
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

    // Find token by pool address or token address
    const allTokens = await repository.findAll(200, 0);
    const token =
      allTokens.find((t) => t.poolAddress.toLowerCase() === address) ??
      allTokens.find((t) => t.address.toLowerCase() === address);

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
    const fromBlock = BigInt(url.searchParams.get('fromBlock') ?? '0');
    const toBlock = BigInt(url.searchParams.get('toBlock') ?? '0');
    const pairId = url.searchParams.get('id') ?? '';
    const poolMatch = pairId.match(/(0x[a-fA-F0-9]{40})/);
    const poolAddress = poolMatch ? (poolMatch[1].toLowerCase() as `0x${string}`) : null;

    const cacheKey = `dex:events:${poolAddress ?? 'all'}:${fromBlock}:${toBlock}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });

    const allTokens = await repository.findAll(200, 0);
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

    const allTokens = await repository.findAll(200, 0);
    const token = allTokens.find((t) => t.poolAddress.toLowerCase() === poolAddr);
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

    const allTokens = await repository.findAll(200, 0);
    const token = allTokens.find((t) => t.poolAddress.toLowerCase() === poolAddr);
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
    const allTokens = await repository.findAll(200, 0);
    const token = allTokens.find((t) => t.poolAddress.toLowerCase() === poolAddr);
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
