import { TokenMarketData } from '@proto/shared-types';

const DEFAULT_SUPPLY = 1_000_000_000n * 10n ** 18n; // 1 billion tokens standard

export class CalculatePricingUseCase {
  /**
   * Compute live market data for a token.
   *
   * Supports two pricing modes:
   *  1. V2 Bonding Curve (spotPriceNative provided): uses virtual AMM spot price directly.
   *  2. V1 Uniswap V3 Pool (sqrtPriceX96 provided): derives price from pool sqrt ratio.
   *
   * The quoteAssetPriceUsd parameter abstracts the quote asset:
   *  - Robinhood Chain (ETH quote): pass live ETH/USD oracle price
   *  - Arc Network (USDC quote, always $1.00): pass 1.0
   */
  execute(params: {
    address: `0x${string}`;
    // V2 bonding curve: pass spot price in native quote asset units
    sqrtPriceX96?: bigint;
    spotPriceNative?: number;
    isToken0?: boolean;
    pairedPrincipalWei: bigint;
    // ethPriceUsd = quoteAssetPriceUsd (1.0 for USDC, live oracle for ETH)
    ethPriceUsd: number;
    volume24hUsd?: number;
    thresholdWei?: bigint;
    totalSupply?: bigint;
  }): TokenMarketData {
    const { ethPriceUsd } = params;
    if (!ethPriceUsd || ethPriceUsd <= 0) {
      throw new Error('Valid quoteAssetPriceUsd (ethPriceUsd) required for pricing');
    }

    // ------------------------------------------------------------------
    // 1. Compute price in native quote asset (ETH or USDC)
    // ------------------------------------------------------------------
    let priceInWeth: number;

    if (params.spotPriceNative !== undefined && params.spotPriceNative > 0) {
      // V2 bonding curve spot price (already in quote-asset units per token)
      priceInWeth = params.spotPriceNative;
    } else {
      // V1 Uniswap V3: derive from sqrtPriceX96
      const sqrt = params.sqrtPriceX96 ?? 2505414483750479299401734n;
      const ratio = Number(sqrt) / 2 ** 96;
      const token1PerToken0 = ratio * ratio;
      priceInWeth = params.isToken0 ? token1PerToken0 : 1 / (token1PerToken0 || 1);
      // Guard against degenerate pool configurations (inverted ratios)
      if (priceInWeth > 1_000_000) {
        priceInWeth = 1 / priceInWeth;
      }
    }

    // ------------------------------------------------------------------
    // 2. USD price
    // ------------------------------------------------------------------
    const priceUsd = priceInWeth * ethPriceUsd;

    // ------------------------------------------------------------------
    // 3. Market cap — use per-token totalSupply when available
    // ------------------------------------------------------------------
    const supplyRaw = params.totalSupply ?? DEFAULT_SUPPLY;
    const supplyTokens = Number(supplyRaw) / 1e18;
    const marketCapUsd = priceUsd * supplyTokens;
    const fdvUsd = marketCapUsd;

    // ------------------------------------------------------------------
    // 4. Graduation progress
    // ------------------------------------------------------------------
    // Default threshold: use a reasonable fallback (4.2 ETH Robinhood / 69K USDC Arc)
    // Callers should always pass thresholdWei for accuracy.
    const thresholdWei = params.thresholdWei ?? 4_200_000_000_000_000_000n;
    const pairedPrincipalWeth = (Number(params.pairedPrincipalWei) / 1e18).toFixed(4);
    const thresholdWethNum = Number(thresholdWei) / 1e18;
    const progress =
      Number(thresholdWei) > 0
        ? Math.min(1.0, Number(params.pairedPrincipalWei) / Number(thresholdWei))
        : 0;

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
