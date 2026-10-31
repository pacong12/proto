import type { CachePort } from '../ports/cache.port';
import type { RouteContext } from './router';

type Envelope = Parameters<RouteContext['replyEnvelope']>[0];

/**
 * The value cached under `key`, or the one `build` returns, cached for `ttlSeconds` when
 * `cacheable` accepts it. An error thrown by `build` is not cached.
 */
export async function readThrough<T>(
  cache: CachePort,
  key: string,
  ttlSeconds: number,
  build: () => Promise<T>,
  cacheable: (value: T) => boolean = () => true,
): Promise<{ value: T; hit: boolean }> {
  const cached = await cache.get<T>(key);
  if (cached) return { value: cached, hit: true };
  const value = await build();
  if (cacheable(value)) await cache.set(key, value, ttlSeconds);
  return { value, hit: false };
}

/** The x-cache header telling whether a reply came from the cache. */
export const cacheHeader = (hit: boolean) => ({ 'x-cache': hit ? 'HIT' : 'MISS' });

/**
 * Serves a cached JSON payload (x-cache: HIT), or builds it, caches it for `ttlSeconds` and
 * serves it (x-cache: MISS).
 */
export async function replyCached(
  cache: CachePort,
  replyJson: RouteContext['replyJson'],
  key: string,
  ttlSeconds: number,
  build: () => Promise<unknown>,
): Promise<Response> {
  const { value, hit } = await readThrough(cache, key, ttlSeconds, build);
  return replyJson(value, 200, cacheHeader(hit));
}

/**
 * Like `replyCached` for an API envelope: only a successful one is cached, and the reply's status
 * follows the envelope (a failure is served with its error's status).
 */
export async function replyCachedEnvelope(
  cache: CachePort,
  replyEnvelope: RouteContext['replyEnvelope'],
  key: string,
  ttlSeconds: number,
  build: () => Promise<Envelope>,
): Promise<Response> {
  const { value, hit } = await readThrough(cache, key, ttlSeconds, build, (env) => env.success);
  return replyEnvelope(value, cacheHeader(hit));
}
