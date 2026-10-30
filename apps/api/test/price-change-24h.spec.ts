import { describe, expect, it } from 'vitest';
import { ROBINHOOD_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import { GetTokenByAddressUseCase } from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';

const NOW = 1_800_000_000_000;
const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
// Curve priced at 3 ETH / 1e9 tokens = 3e-9 ETH; at $2000/ETH that is $6e-6 per token.
const indexer = {
  fetchV2CurveState: async () => ({
    totalEthRaised: 0n,
    virtualEthReserve: 3n * 10n ** 18n,
    virtualTokenReserve: 10n ** 27n,
    graduationTarget: 42n * 10n ** 17n,
    graduated: false,
  }),
};
const priceFeed = { getQuoteAssetPriceUsd: async () => 2000 };

async function changeWith(trades: Array<{ priceUsd: number; agoMs: number }>) {
  const repo = new InMemoryTokenRepository();
  await repo.save({
    address: TOKEN,
    name: 'T',
    symbol: 'T',
    decimals: 18,
    totalSupply: '1000000000000000000000000000',
    logo: '',
    description: '',
    socials: {},
    deployer: TOKEN,
    pairedToken: ROBINHOOD_CHAIN.contracts.weth,
    poolAddress: TOKEN,
    curveAddress: TOKEN,
    isToken0: false,
    poolFee: 10000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: 0,
    initialBuyAmount: '0',
    version: 'v2',
  } as unknown as LaunchedTokenEntity);
  for (const [i, t] of trades.entries()) {
    await repo.saveTrade({
      id: `t${i}`,
      tokenAddress: TOKEN,
      poolAddress: TOKEN,
      trader: TOKEN,
      isBuy: true,
      tokenAmount: '1',
      wethAmount: '0.1',
      priceUsd: t.priceUsd,
      blockNumber: 1n,
      transactionHash: '0x0',
      timestamp: NOW - t.agoMs,
    });
  }
  const useCase = new GetTokenByAddressUseCase(
    repo,
    indexer as never,
    new CalculatePricingUseCase(),
    priceFeed as never,
    () => NOW,
  );
  return (await useCase.execute(TOKEN))!.marketData.priceChange24h;
}

describe('priceChange24h', () => {
  it('compares with the last trade before 24h ago (timestamps in ms)', async () => {
    // Was always 0: the cutoff was in seconds while trades are stored in milliseconds.
    const change = await changeWith([
      { priceUsd: 5e-6, agoMs: 3_600_000 },
      { priceUsd: 3e-6, agoMs: 25 * 3_600_000 },
    ]);
    expect(change).toBeCloseTo(100, 6); // 3e-6 -> 6e-6
  });

  it('is 0 when nothing traded in the last 24h, whatever the quote did since', async () => {
    // TEST on Robinhood showed -9.85%: its last trade was 16 days old and ETH had moved since.
    const change = await changeWith([{ priceUsd: 3e-6, agoMs: 16 * 86_400_000 }]);
    expect(change).toBe(0);
  });

  it('for a token younger than 24h, compares with its first trade', async () => {
    const change = await changeWith([
      { priceUsd: 5e-6, agoMs: 600_000 },
      { priceUsd: 4e-6, agoMs: 7_200_000 },
    ]);
    expect(change).toBeCloseTo(50, 6); // 4e-6 -> 6e-6
  });

  it('reaches back 24h for a token with more than 500 trades in the window', async () => {
    // The newest 500 trades of a busy token are all hours old at most: the change was measured
    // against one of them (here 0%) instead of the price 24h ago.
    const busy = Array.from({ length: 600 }, (_, i) => ({
      priceUsd: 6e-6,
      agoMs: 60_000 * (i + 1),
    }));
    // Saved oldest first, as the indexer does.
    const change = await changeWith([{ priceUsd: 3e-6, agoMs: 25 * 3_600_000 }, ...busy.reverse()]);
    expect(change).toBeCloseTo(100, 6); // 3e-6 -> 6e-6
  });
});
