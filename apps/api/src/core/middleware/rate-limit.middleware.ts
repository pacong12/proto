import type { CachePort } from '../ports/cache.port';
import type { LoggerPort } from '../ports/logger.port';
import { anonymizeIp } from '../privacy';

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
 * Tiered rate limiter: counts per tier and client in the shared cache (Redis), and in memory while
 * the shared cache is down, so an outage never lifts the limit. IPs are logged anonymised.
 */
export class RateLimiter {
  constructor(
    private readonly cache: CachePort,
    private readonly fallback: CachePort,
    private readonly logger: LoggerPort,
  ) {}

  async allow(
    ip: string,
    limit: number,
    windowMs = 60_000,
    tier: RateLimitTier = 'api',
  ): Promise<boolean> {
    const key = `ratelimit:${tier}:${ip}`;
    try {
      return (await this.cache.increment(key, windowMs)) <= limit;
    } catch {
      this.logger.warn('Rate limit Redis unavailable, using in-memory fallback', {
        ip: anonymizeIp(ip),
      });
      return (await this.fallback.increment(key, windowMs)) <= limit;
    }
  }
}
