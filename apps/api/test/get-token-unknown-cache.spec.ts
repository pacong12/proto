import { describe, expect, it, vi } from 'vitest';
import type { LaunchedTokenEntity } from '@goton/shared-types';
import {
  GetTokenByAddressUseCase,
  UNKNOWN_TOKEN_TTL_MS,
} from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';

const ADDRESS = '0x2222222222222222222222222222222222222222' as const;

function setup(
  found: Partial<Record<'v2arc' | 'v2rh' | 'v1rh' | 'v1arc', LaunchedTokenEntity>> = {},
) {
  let clock = 1_000_000;
  const calls = { v2arc: 0, v2rh: 0, v1rh: 0, v1arc: 0 };
  const delay = <T>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), 5));
  const chainIndexer = {
    fetchV2LaunchedTokenFromFactory: vi.fn((_a: string, chain: { chainId: number }) => {
      const k = chain.chainId === 5042 ? 'v2arc' : 'v2rh';
      calls[k]++;
      return delay(found[k] ?? null);
    }),
    fetchLaunchedTokenFromChain: vi.fn((_a: string, chain: { chainId: number }) => {
      const k = chain.chainId === 5042 ? 'v1arc' : 'v1rh';
      calls[k]++;
      return delay(found[k] ?? null);
    }),
  };
  const repository = { findByAddress: vi.fn(async () => null), save: vi.fn(async () => undefined) };
  const useCase = new GetTokenByAddressUseCase(
    repository as never,
    chainIndexer as never,
    {} as never,
    {} as never,
    () => clock,
  );
  const total = () => calls.v2arc + calls.v2rh + calls.v1rh + calls.v1arc;
  return { useCase, repository, total, advance: (ms: number) => (clock += ms) };
}

describe('GetTokenByAddressUseCase: unknown addresses', () => {
  it('remembers an unknown address instead of querying every chain again', async () => {
    const { useCase, total } = setup();
    expect(await useCase.execute(ADDRESS)).toBeNull();
    expect(total()).toBe(4);
    for (let i = 0; i < 10; i++) expect(await useCase.execute(ADDRESS)).toBeNull();
    expect(total()).toBe(4);
  });

  it('shares one lookup between concurrent requests', async () => {
    const { useCase, total } = setup();
    await Promise.all(Array.from({ length: 20 }, () => useCase.execute(ADDRESS)));
    expect(total()).toBe(4);
  });

  it('looks again after the TTL and for other casings of the same address only once', async () => {
    const { useCase, total, advance } = setup();
    await useCase.execute(ADDRESS);
    await useCase.execute(ADDRESS.toUpperCase().replace('0X', '0x') as `0x${string}`);
    expect(total()).toBe(4);
    advance(UNKNOWN_TOKEN_TTL_MS + 1);
    await useCase.execute(ADDRESS);
    expect(total()).toBe(8);
  });

  it('saves a token found on chain and keeps the original chain priority', async () => {
    const arcV2 = { address: ADDRESS, name: 'ArcV2' } as unknown as LaunchedTokenEntity;
    const rhV1 = { address: ADDRESS, name: 'RhV1' } as unknown as LaunchedTokenEntity;
    const { useCase, repository } = setup({ v2arc: arcV2, v1rh: rhV1 });
    // Pricing is not under test; stop right after hydration.
    (useCase as unknown as { priceFeed: unknown }).priceFeed = {
      getQuoteAssetPriceUsd: async () => {
        throw new Error('stop');
      },
    };
    await expect(useCase.execute(ADDRESS)).rejects.toThrow('stop');
    expect(repository.save).toHaveBeenCalledWith(arcV2);
  });
});
