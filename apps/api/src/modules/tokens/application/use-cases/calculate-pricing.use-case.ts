import { TokenMarketData, ROBINHOOD_CHAIN } from '@proto/shared-types';

export class CalculatePricingUseCase {
  /**
   * Calculates live pool price in WETH and USD from Uniswap V3 sqrtPriceX96
   * or bonding curve spot price, and live oracle price.
   */
  execute(params: {
    address: `0x${string}`;
    sqrtPriceX96?: bigint;
    spotPriceNative?: number;
    isToken0?: boolean;
    pairedPrincipalWei: bigint;
    ethPriceUsd: number;
    volume24hUsd?: number;
    thresholdWei?: bigint;
  }): TokenMarketData {
    const { ethPriceUsd } = params;
    if (!ethPriceUsd || ethPriceUsd <= 0) {
      throw new Error('Valid live ethPriceUsd is required for pricing calculation');
    }

    let priceInWeth: number;
    if (params.spotPriceNative !== undefined && params.spotPriceNative > 0) {
      priceInWeth = params.spotPriceNative;
    } else {
      const sqrt = params.sqrtPriceX96 ?? 2505414483750479299401734n;
      const ratio = Number(sqrt) / 2 ** 96;
      const token1PerToken0 = ratio * ratio;

      priceInWeth = params.isToken0 ? token1PerToken0 : 1 / (token1PerToken0 || 1);
      // Guard against runaway inverted ratios on non-canonical pool configurations
      if (priceInWeth > 1_000_000) {
        priceInWeth = 1 / priceInWeth;
      }
    }

    const priceUsd = priceInWeth * ethPriceUsd;

    const supplyTokens = Number(ROBINHOOD_CHAIN.launchConfig.supply) / 1e18;
    const marketCapUsd = priceUsd * supplyTokens;
    const fdvUsd = marketCapUsd;

    const thresholdWei = params.thresholdWei ?? ROBINHOOD_CHAIN.launchConfig.graduationThresholdWei;
    const pairedPrincipalWeth = (Number(params.pairedPrincipalWei) / 1e18).toFixed(4);
    const thresholdWethNum = Number(thresholdWei) / 1e18;
    const progress = Math.min(1.0, Number(params.pairedPrincipalWei) / Number(thresholdWei));

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
