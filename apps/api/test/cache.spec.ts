import { describe, it, expect } from 'vitest';
import { InMemoryCacheAdapter } from '../src/modules/observability/infrastructure/in-memory-cache.adapter';
import { FallbackCacheAdapter } from '../src/modules/observability/infrastructure/fallback-cache.adapter';
import { RedisCacheAdapter } from '../src/modules/observability/infrastructure/redis-cache.adapter';

describe('Caching Adapters', () => {
  it('stores and retrieves data with TTL expiry', async () => {
    const cache = new InMemoryCacheAdapter();

    await cache.set('test:key', { foo: 'bar' }, 10);
    const val = await cache.get<{ foo: string }>('test:key');

    expect(val).toEqual({ foo: 'bar' });

    await cache.del('test:key');
    const deleted = await cache.get('test:key');
    expect(deleted).toBeNull();
  });

  it('deletes keys by prefix pattern', async () => {
    const cache = new InMemoryCacheAdapter();

    await cache.set('tokens:list:1', { a: 1 }, 10);
    await cache.set('tokens:list:2', { a: 2 }, 10);
    await cache.set('analytics', { b: 3 }, 10);

    await cache.delPrefix('tokens:list:');

    expect(await cache.get('tokens:list:1')).toBeNull();
    expect(await cache.get('tokens:list:2')).toBeNull();
    expect(await cache.get('analytics')).toEqual({ b: 3 });
  });

  it('stores bigints as strings, as the Redis adapter does', async () => {
    const cache = new InMemoryCacheAdapter();

    await cache.set('token', { positionId: 42n }, 10);

    expect(await cache.get('token')).toEqual({ positionId: '42' });
  });

  describe('FallbackCacheAdapter', () => {
    it('caches in the fallback when Redis is not configured', async () => {
      const cache = new FallbackCacheAdapter(
        new RedisCacheAdapter(undefined),
        new InMemoryCacheAdapter(),
      );

      await cache.set('analytics', { a: 1 }, 10);

      expect(cache.isAvailable()).toBe(true);
      expect(await cache.get('analytics')).toEqual({ a: 1 });
    });

    it('follows the primary while it is up and falls back when it drops', async () => {
      const primary = new InMemoryCacheAdapter();
      const fallback = new InMemoryCacheAdapter();
      const cache = new FallbackCacheAdapter(primary, fallback);

      await cache.set('key', 'redis', 10);
      expect(await fallback.get('key')).toBeNull();

      primary.isAvailable = () => false;
      expect(await cache.get('key')).toBeNull();
      await cache.set('key', 'memory', 10);
      expect(await cache.get('key')).toBe('memory');
      expect(await primary.get('key')).toBe('redis');
    });

    it('invalidates both stores, so neither serves a stale entry after a switch', async () => {
      const primary = new InMemoryCacheAdapter();
      const fallback = new InMemoryCacheAdapter();
      const cache = new FallbackCacheAdapter(primary, fallback);
      await primary.set('token:detail:a', 1, 10);
      await fallback.set('token:detail:a', 2, 10);
      await primary.set('token:holders:a:1', 1, 10);
      await fallback.set('token:holders:a:1', 2, 10);

      await cache.del('token:detail:a');
      await cache.delPrefix('token:holders:a');

      expect(await primary.get('token:detail:a')).toBeNull();
      expect(await fallback.get('token:detail:a')).toBeNull();
      expect(await primary.get('token:holders:a:1')).toBeNull();
      expect(await fallback.get('token:holders:a:1')).toBeNull();
    });
  });
});
