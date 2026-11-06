import { describe, expect, it } from 'vitest';
import { ROBINHOOD_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import { GetTokenByAddressUseCase } from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';

const NOW = 1_800_000_000_000;
const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const graduatedCurve = {
  fetchV2CurveState: async () => ({
    totalEthRaised: 42n * 10n ** 17n,
    virtualEthReserve: 3n * 10n ** 18n,
    virtualTokenReserve: 10n ** 27n,
    graduationTarget: 42n * 10n ** 17n,
    graduated: true,
  }),
};

describe('graduated token market data', () => {
  it('uses the newest trade even when its block is stamped ahead of the server clock', async () => {
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
      isGraduated: true,
    } as unknown as LaunchedTokenEntity);
    // The first curve trade, then pool trades whose blocks are ahead of this server's clock.
    const trades = [
      { priceQuote: 2e-9, at: NOW - 3_600_000 },
      { priceQuote: 3e-7, at: NOW + 5_000 },
      { priceQuote: 4e-7, at: NOW + 9_000 },
    ];
    for (const [i, t] of trades.entries()) {
      await repo.saveTrade({
        id: `t${i}`,
        tokenAddress: TOKEN,
        poolAddress: TOKEN,
        trader: TOKEN,
        isBuy: true,
        tokenAmount: '1',
        wethAmount: '0.1',
        priceUsd: t.priceQuote * 2000,
        priceQuote: t.priceQuote,
        blockNumber: BigInt(i + 1),
        transactionHash: '0x0',
        timestamp: t.at,
      } as never);
    }
    const useCase = new GetTokenByAddressUseCase(
      repo,
      graduatedCurve as never,
      new CalculatePricingUseCase(),
      { getQuoteAssetPriceUsd: async () => 2000 } as never,
      () => NOW,
    );
    const { marketData } = (await useCase.execute(TOKEN))!;
    expect(marketData.priceInWeth).toBeCloseTo(4e-7, 15);
    expect(marketData.marketCapUsd).toBeCloseTo(4e-7 * 2000 * 1e9, 3);
  });
});
