import type { CachePort } from '../ports/cache.port';
import type { RouteContext } from './router';

/**
 * Serves a cached JSON payload (x-cache: HIT), or builds it, caches it for `ttlSeconds` and
 * serves it (x-cache: MISS). An error thrown by `build` is not cached.
 */
export async function replyCached(
  cache: CachePort,
  replyJson: RouteContext['replyJson'],
  key: string,
  ttlSeconds: number,
  build: () => Promise<unknown>,
): Promise<Response> {
  const cached = await cache.get<unknown>(key);
  if (cached) return replyJson(cached, 200, { 'x-cache': 'HIT' });
  const payload = await build();
  await cache.set(key, payload, ttlSeconds);
  return replyJson(payload, 200, { 'x-cache': 'MISS' });
}
