import { describe, expect, it } from 'vitest';
import { readThrough } from '../src/core/http/cached-reply';
import { InMemoryCacheAdapter } from '../src/modules/observability/infrastructure/in-memory-cache.adapter';
import {
  GetTopTradersUseCase,
  TOP_TRADERS_CACHE_SIZE,
} from '../src/modules/trades/application/use-cases/get-top-traders.use-case';

describe('cache readiness', () => {
  it('builds a missed key once for concurrent requests', async () => {
    const cache = new InMemoryCacheAdapter();
    let builds = 0;
    const build = async () => {
      builds++;
      await new Promise((r) => setTimeout(r, 20));
      return { n: builds };
    };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => readThrough(cache, 'k', 60, build)),
    );
    expect(builds).toBe(1);
    expect(results.every((r) => r.value.n === 1)).toBe(true);
    expect((await readThrough(cache, 'k', 60, build)).hit).toBe(true);
    await cache.close();
  });

  it('lets the next request rebuild after a failed build', async () => {
    const cache = new InMemoryCacheAdapter();
    await expect(
      readThrough(cache, 'f', 60, async () => {
        throw new Error('rpc down');
      }),
    ).rejects.toThrow('rpc down');
    expect((await readThrough(cache, 'f', 60, async () => 'ok')).value).toBe('ok');
    await cache.close();
  });

  it('keeps the top-traders memo bounded', async () => {
    const empty = { getTrades: async () => [], findByAddress: async () => null };
    const useCase = new GetTopTradersUseCase(
      empty as never,
      empty as never,
      { getQuoteAssetPriceUsd: async () => 1 } as never,
    );
    for (let i = 0; i < TOP_TRADERS_CACHE_SIZE + 50; i++) {
      await useCase.execute(`0x${i.toString(16).padStart(40, '0')}`);
    }
    const memo = (useCase as unknown as { cache: Map<string, unknown> }).cache;
    expect(memo.size).toBe(TOP_TRADERS_CACHE_SIZE);
  });
});
