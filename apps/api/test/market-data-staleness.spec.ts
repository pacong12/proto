import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';

const token = (n: number): LaunchedTokenEntity => ({
  address: `0x${n.toString(16).padStart(40, '0')}`,
  name: `T${n}`,
  symbol: `T${n}`,
  decimals: 18,
  totalSupply: '1000000000000000000000000000',
  logo: '',
  description: '',
  socials: {},
  deployer: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  pairedToken: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  poolAddress: `0x${(n + 100).toString(16).padStart(40, '0')}`,
  isToken0: true,
  poolFee: 10000,
  positionId: 0n,
  restrictionsEndBlock: 0n,
  launchBlock: 0n,
  createdAt: 1700000000000,
  initialBuyAmount: '0',
});
const market = (address: `0x${string}`): TokenMarketData => ({
  address,
  priceInWeth: 1e-9,
  priceUsd: 1e-6,
  marketCapUsd: 1000,
  fdvUsd: 1000,
  pairedPrincipalWeth: '0',
  graduationThresholdWeth: '4.2',
  graduationProgress: 0,
  isGraduated: false,
  volume24hUsd: 0,
});

describe.each([
  ['sqlite', () => new SqliteTokenRepository(':memory:')],
  ['in-memory', () => new InMemoryTokenRepository()],
])('findStaleMarketData (%s)', (_name, make) => {
  afterEach(() => vi.useRealTimers());

  it('returns tokens without market data and rows older than the cutoff, oldest first', async () => {
    vi.useFakeTimers();
    const repo = make();
    const [a, b, c] = [token(1), token(2), token(3)];
    for (const t of [a, b, c]) await repo.save(t);

    vi.setSystemTime(1_000_000);
    await repo.saveMarketData(market(a.address)); // old
    vi.setSystemTime(2_000_000);
    await repo.saveMarketData(market(b.address)); // fresh
    // c has no market data at all

    const stale = await repo.findStaleMarketData!(1_500_000, 10);
    expect(stale.map((x) => x.toLowerCase())).toEqual([c.address, a.address]);
    expect(await repo.findStaleMarketData!(1_500_000, 1)).toHaveLength(1);
  });
});
