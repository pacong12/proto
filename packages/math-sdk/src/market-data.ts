import { TOTAL_SUPPLY_WEI } from './constants';
import { calculateSpotPrice } from './bonding-curve';

export interface MarketDataParams {
  address: `0x${string}`;
  /** V2 bonding curve: spot price in quote units per token. */
  spotPriceNative?: number;
  /** V1 Uniswap V3 pool: sqrt price, with the token's side of the pool. */
  sqrtPriceX96?: bigint;
  isToken0?: boolean;
  /** Quote raised so far (wei). */
  pairedPrincipalWei: bigint;
  /** USD price of the quote asset: the live ETH price, or 1 for a USDC quote. */
  quotePriceUsd: number;
  volume24hUsd?: number;
  /** Quote that graduates the token (wei); callers should always pass it. */
  thresholdWei?: bigint;
  totalSupply?: bigint;
}

/** A token's market snapshot; `graduationProgress` runs from 0 to 1. */
export interface MarketData {
  address: `0x${string}`;
  priceInWeth: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  pairedPrincipalWeth: string;
  graduationThresholdWeth: string;
  graduationProgress: number;
  isGraduated: boolean;
  volume24hUsd: number;
}

/**
 * Prices a token in its quote asset and in USD, with its market cap and graduation progress.
 * A bonding-curve token is priced from its spot price, a V1 pool token from its sqrt price.
 */
export function calculateMarketData(params: MarketDataParams): MarketData {
  const { quotePriceUsd } = params;
  if (!quotePriceUsd || quotePriceUsd <= 0) {
    throw new Error('A positive quotePriceUsd is required for pricing');
  }

  let priceInWeth: number;
  if (params.spotPriceNative !== undefined && params.spotPriceNative > 0) {
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

  const priceUsd = priceInWeth * quotePriceUsd;
  const supplyTokens = Number(params.totalSupply ?? TOTAL_SUPPLY_WEI) / 1e18;
  const marketCapUsd = priceUsd * supplyTokens;

  // Callers should always pass thresholdWei; 4.2 ETH is the bonding-curve default.
  const thresholdWei = params.thresholdWei ?? 4_200_000_000_000_000_000n;
  const progress =
    Number(thresholdWei) > 0
      ? Math.min(1.0, Number(params.pairedPrincipalWei) / Number(thresholdWei))
      : 0;

  return {
    address: params.address,
    priceInWeth,
    priceUsd,
    marketCapUsd,
    fdvUsd: marketCapUsd,
    pairedPrincipalWeth: (Number(params.pairedPrincipalWei) / 1e18).toFixed(4),
    graduationThresholdWeth: (Number(thresholdWei) / 1e18).toString(),
    graduationProgress: progress,
    isGraduated: progress >= 1.0,
    volume24hUsd: params.volume24hUsd ?? 0,
  };
}

export interface CurveMarketParams {
  address: `0x${string}`;
  /** The curve's reserves and progress, in wei / token base units. */
  virtualEthReserve: bigint;
  virtualTokenReserve: bigint;
  totalEthRaised: bigint;
  graduationTarget: bigint;
  totalSupply?: bigint;
  tokenDecimals?: number;
  quotePriceUsd: number;
}

/** Market data of a token still on its bonding curve, priced from the curve's reserves. */
export function calculateCurveMarketData(params: CurveMarketParams): MarketData {
  return calculateMarketData({
    address: params.address,
    spotPriceNative: calculateSpotPrice(
      Number(params.virtualEthReserve) / 1e18,
      Number(params.virtualTokenReserve) / 10 ** (params.tokenDecimals ?? 18),
    ),
    pairedPrincipalWei: params.totalEthRaised,
    quotePriceUsd: params.quotePriceUsd,
    thresholdWei: params.graduationTarget,
    totalSupply: params.totalSupply,
  });
}
