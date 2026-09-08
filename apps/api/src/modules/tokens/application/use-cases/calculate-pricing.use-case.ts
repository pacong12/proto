import { TokenMarketData, ROBINHOOD_CHAIN } from '@proto/shared-types';

export class CalculatePricingUseCase {
  /**
   * Calculates live pool price in WETH and USD from Uniswap V3 sqrtPriceX96.
   * sqrtPriceX96 = sqrt(price) * 2^96
   * price = (sqrtPriceX96 / 2^96)^2
   */
  execute(params: {
    address: `0x${string}`;
    sqrtPriceX96: bigint;
    isToken0: boolean;
    pairedPrincipalWei: bigint;
    ethPriceUsd?: number;
    volume24hUsd?: number;
  }): TokenMarketData {
    const ethPriceUsd = params.ethPriceUsd ?? 3000;
    const ratio = Number(params.sqrtPriceX96) / 2 ** 96;
    const token1PerToken0 = ratio * ratio;

    const priceInWeth = params.isToken0 ? token1PerToken0 : 1 / (token1PerToken0 || 1);
    const priceUsd = priceInWeth * ethPriceUsd;

    const supplyTokens = Number(ROBINHOOD_CHAIN.launchConfig.supply) / 1e18;
    const marketCapUsd = priceUsd * supplyTokens;
    const fdvUsd = marketCapUsd;

    const pairedPrincipalWeth = (Number(params.pairedPrincipalWei) / 1e18).toFixed(4);
    const thresholdWethNum = Number(ROBINHOOD_CHAIN.launchConfig.graduationThresholdWei) / 1e18;
    const progress = Math.min(1.0, Number(params.pairedPrincipalWei) / Number(ROBINHOOD_CHAIN.launchConfig.graduationThresholdWei));

    return {
      address: params.address,
      priceInWeth,
      priceUsd,
      marketCapUsd,
      fdvUsd,
      pairedPrincipalWeth,
      graduationThresholdWeth: thresholdWethNum.toString(),
      graduationProgress: progress,
      isGraduated: progress >= 1.0,
      volume24hUsd: params.volume24hUsd ?? 0,
    };
  }
}
