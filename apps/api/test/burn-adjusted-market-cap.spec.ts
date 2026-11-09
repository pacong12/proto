import { describe, expect, it } from 'vitest';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';

const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const DEAD = '0x000000000000000000000000000000000000dEaD' as const;
const HOLDER = '0x00000000000000000000000000000000000000c1' as const;

async function setup() {
  const repo = new SqliteTokenRepository(':memory:');
  // $0.0001 a token, 1B minted: $100,000 stored, as every writer computes it.
  await repo.saveMarketData({
    address: TOKEN,
    priceInWeth: 1e-8,
    priceUsd: 0.0001,
    marketCapUsd: 100_000,
    fdvUsd: 100_000,
    pairedPrincipalWeth: '0',
    graduationThresholdWeth: '4.2',
    graduationProgress: 1,
    isGraduated: true,
    volume24hUsd: 0,
  });
  return repo;
}

describe('market cap net of burned tokens', () => {
  it('takes tokens at the burn address off the market cap, not off the FDV', async () => {
    const repo = await setup();
    // 120M at 0xdEaD (buybacks, LP token fees); a wallet's balance does not count.
    await repo.saveBalances!(TOKEN, [
      { holder: DEAD, balance: 120_000_000n * 10n ** 18n },
      { holder: HOLDER, balance: 50_000_000n * 10n ** 18n },
    ]);
    const mkt = await repo.getMarketData(TOKEN);
    expect(mkt?.marketCapUsd).toBeCloseTo(88_000, 6);
    expect(mkt?.fdvUsd).toBe(100_000);
  });

  it('keeps the market cap of a token with nothing burned', async () => {
    const repo = await setup();
    expect((await repo.getMarketData(TOKEN))?.marketCapUsd).toBe(100_000);
  });
});
