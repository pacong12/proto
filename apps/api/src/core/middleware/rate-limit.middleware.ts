import type { CachePort } from '../../modules/observability/domain/ports/cache.port';
import type { LoggerPort } from '../../modules/observability/domain/ports/logger.port';

export type RateLimitTier = 'api' | 'crawler' | 'upload' | 'terminal';

export function resolveRateLimitTier(
  pathname: string,
  method: string,
): { tier: RateLimitTier; maxRequests: number } {
  const isPublicCrawlerPath = pathname.startsWith('/dex/') || pathname.startsWith('/api/v1/');
  const isUploadPath = pathname === '/api/ipfs/upload';
  const isLiveTerminalRead = pathname.startsWith('/api/tokens/') && method === 'GET';

  if (isPublicCrawlerPath) {
    return { tier: 'crawler', maxRequests: 600 };
  }
  if (isUploadPath) {
    return { tier: 'upload', maxRequests: 10 };
  }
  if (isLiveTerminalRead) {
    return { tier: 'terminal', maxRequests: 600 };
  }
  return { tier: 'api', maxRequests: 300 };
}

/**
 * Tiered Rate Limiter with Redis primary and In-Memory fallback.
 */
export async function checkRateLimit(
  ip: string,
  limit: number,
  windowMs = 60_000,
  tier: RateLimitTier = 'api',
  primaryCache?: CachePort,
  fallbackCache?: CachePort,
  logger?: LoggerPort,
): Promise<boolean> {
  const key = `ratelimit:${tier}:${ip}`;
  if (primaryCache) {
    try {
      const count = await primaryCache.increment(key, windowMs);
      return count <= limit;
    } catch {
      logger?.warn('Rate limit primary cache unavailable, using in-memory fallback', { ip });
    }
  }

  if (fallbackCache) {
    try {
      const count = await fallbackCache.increment(key, windowMs);
      return count <= limit;
    } catch {
      // Both caches failed
      return true;
    }
  }

  return true;
}
