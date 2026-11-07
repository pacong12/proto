import { CachePort } from '../../../core/ports/cache.port';

/**
 * Serves from `primary` while it is available and from `fallback` when it is not, so routes stay
 * cached without Redis instead of rerunning their queries on every request.
 */
export class FallbackCacheAdapter implements CachePort {
  constructor(
    private readonly primary: CachePort,
    private readonly fallback: CachePort,
  ) {}

  private get active(): CachePort {
    return this.primary.isAvailable() ? this.primary : this.fallback;
  }

  isAvailable(): boolean {
    return this.active.isAvailable();
  }

  get<T>(key: string): Promise<T | null> {
    return this.active.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    return this.active.set(key, value, ttlSeconds);
  }

  increment(key: string, ttlMs: number): Promise<number> {
    return this.active.increment(key, ttlMs);
  }

  /** Both stores: an entry left behind would be served again if Redis drops or comes back. */
  async del(key: string): Promise<void> {
    await Promise.all([this.primary.del(key), this.fallback.del(key)]);
  }

  async delPrefix(prefix: string): Promise<void> {
    await Promise.all([this.primary.delPrefix(prefix), this.fallback.delPrefix(prefix)]);
  }

  async close(): Promise<void> {
    await Promise.all([this.primary.close(), this.fallback.close()]);
  }
}
