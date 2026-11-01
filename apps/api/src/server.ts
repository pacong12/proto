import { logger } from './index';
import {
  resolveCorsOrigin,
  buildSecurityHeaders,
  resolveRateLimitTier,
  createReplies,
  anonymizeIp,
  Router,
  extractClientIp,
  type PeerAddressSource,
} from './core';

import * as container from './app/container';
import { startBackgroundJobs } from './app/jobs';
import { registerObservabilityRoutes } from './modules/observability/presentation/observability.routes';
import { registerTokensRoutes } from './modules/tokens/presentation/tokens.routes';
import { registerTradesRoutes } from './modules/trades/presentation/trades.routes';
import { registerSocialRoutes } from './modules/social/presentation/social.routes';
import { registerSecurityRoutes } from './modules/security/presentation/security.routes';
import { registerIpfsRoutes } from './modules/ipfs/ipfs.routes';
import { registerDexRoutes } from './modules/dex/dex.routes';

const { rateLimiter, requestTracker } = container;

const PORT =
  process.env.NODE_ENV === 'test'
    ? 0
    : parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10);

startBackgroundJobs();

/** Every module's routes, in the order they are matched. */
const router = new Router();
registerObservabilityRoutes(router, container);
registerTokensRoutes(router, container);
registerTradesRoutes(router, container);
registerSocialRoutes(router, container);
registerSecurityRoutes(router, container);
registerIpfsRoutes(router, container);
registerDexRoutes(router, container);

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

  const replies = createReplies(headers);

  const isHealthProbe = url.pathname === '/health' || url.pathname === '/';
  const { tier: rateTier, maxRequests } = resolveRateLimitTier(url.pathname, req.method);
  if (!isHealthProbe && !(await rateLimiter.allow(clientIp, maxRequests, 60_000, rateTier))) {
    return replies.replyError('RATE_LIMIT_EXCEEDED', 'Too many requests, please slow down.', 429);
  }

  const res = await router.handle({ req, url, clientIp, headers, corsOrigin, ...replies });
  return res ?? replies.replyError('NOT_FOUND', `Route ${url.pathname} not found`, 404);
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
