import { describe, it, expect } from 'vitest';
import { InMemoryCacheAdapter } from '../src/modules/observability/infrastructure/in-memory-cache.adapter';

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
});
