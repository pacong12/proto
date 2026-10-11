import { BPS, TRADE_FEE_BPS, CURVE_TOKEN_SUPPLY_NUM, POOL_RESERVE_SUPPLY_WEI } from './constants';

/**
 * Calculates current AMM spot price in quote currency units (ETH or USDC).
 * Optionally converts to USD if quotePriceUsd is provided.
 */
export function calculateSpotPrice(
  virtualEthReserve: number,
  virtualTokenReserve: number,
  quotePriceUsd = 1.0,
): number {
  if (virtualTokenReserve <= 0 || virtualEthReserve <= 0) return 0;
  const spotPriceNative = virtualEthReserve / virtualTokenReserve;
  return spotPriceNative * quotePriceUsd;
}

/**
 * Calculates token output and platform fee for a given quote asset input (ETH / USDC).
 * Floating-point variant designed for instantaneous UI preview.
 */
export function calculateCurveBuyOutput(
  ethIn: number,
  virtualEthReserve: number,
  virtualTokenReserve: number,
  maxAvailableTokens: number = CURVE_TOKEN_SUPPLY_NUM,
): number {
  if (ethIn <= 0 || virtualEthReserve <= 0 || virtualTokenReserve <= 0) return 0;
  // 1% fee deducted before AMM calculation
  const netEth = ethIn * 0.99;
  const k = virtualEthReserve * virtualTokenReserve;
  const newEthReserve = virtualEthReserve + netEth;
  const newTokenReserve = k / newEthReserve;
  const rawOut = Math.max(0, virtualTokenReserve - newTokenReserve);
  return Math.min(rawOut, maxAvailableTokens);
}

/**
 * Calculates gross & net quote asset output (ETH / USDC) for a given token input.
 * Floating-point variant designed for instantaneous UI preview.
 */
export function calculateCurveSellOutput(
  tokensIn: number,
  virtualEthReserve: number,
  virtualTokenReserve: number,
): number {
  if (tokensIn <= 0 || virtualEthReserve <= 0 || virtualTokenReserve <= 0) return 0;
  const k = virtualEthReserve * virtualTokenReserve;
  const newTokenReserve = virtualTokenReserve + tokensIn;
  const newEthReserve = k / newTokenReserve;
  const grossEth = Math.max(0, virtualEthReserve - newEthReserve);
  // 1% fee deducted from gross proceeds
  return grossEth * 0.99;
}

/**
 * Precise BigInt wei calculation matching BondingCurve.sol getAmountOutBuy() exactly.
 */
export function getAmountOutBuyWei(
  ethInWei: bigint,
  virtualEthWei: bigint,
  virtualTokenWei: bigint,
  totalAvailableTokensWei?: bigint,
): { tokenOutWei: bigint; feeEthWei: bigint } {
  if (ethInWei <= 0n || virtualEthWei <= 0n || virtualTokenWei <= 0n) {
    return { tokenOutWei: 0n, feeEthWei: 0n };
  }

  const feeEthWei = (ethInWei * TRADE_FEE_BPS) / BPS;
  const netEthWei = ethInWei - feeEthWei;

  const currentK = virtualEthWei * virtualTokenWei;
  const newEthReserve = virtualEthWei + netEthWei;
  const newTokenReserve = currentK / newEthReserve;

  let tokenOutWei = virtualTokenWei - newTokenReserve;

  // Enforce contract curve cap if token balance passed
  if (totalAvailableTokensWei !== undefined && totalAvailableTokensWei > POOL_RESERVE_SUPPLY_WEI) {
    const curveAvailable = totalAvailableTokensWei - POOL_RESERVE_SUPPLY_WEI;
    if (tokenOutWei > curveAvailable) {
      tokenOutWei = curveAvailable;
    }
  }

  return { tokenOutWei, feeEthWei };
}

/**
 * Precise BigInt wei calculation matching BondingCurve.sol getAmountOutSell() exactly.
 */
export function getAmountOutSellWei(
  tokenInWei: bigint,
  virtualEthWei: bigint,
  virtualTokenWei: bigint,
): { ethOutWei: bigint; feeEthWei: bigint } {
  if (tokenInWei <= 0n || virtualEthWei <= 0n || virtualTokenWei <= 0n) {
    return { ethOutWei: 0n, feeEthWei: 0n };
  }

  const currentK = virtualEthWei * virtualTokenWei;
  const newTokenReserve = virtualTokenWei + tokenInWei;
  const newEthReserve = currentK / newTokenReserve;

  const grossEth = virtualEthWei > newEthReserve ? virtualEthWei - newEthReserve : 0n;
  const feeEthWei = (grossEth * TRADE_FEE_BPS) / BPS;
  const ethOutWei = grossEth > feeEthWei ? grossEth - feeEthWei : 0n;

  return { ethOutWei, feeEthWei };
}

/**
 * Calculates estimated percentage price impact for a swap input.
 * formula: (amountIn / (reserveIn + amountIn)) * 100
 */
export function calculatePriceImpact(amountIn: number, reserveIn: number): number {
  if (amountIn <= 0 || reserveIn <= 0) return 0;
  return (amountIn / (reserveIn + amountIn)) * 100;
}

/**
 * Calculates progress toward graduation threshold (0.0 to 1.0).
 */
export function calculateGraduationProgress(totalRaisedWei: bigint, targetWei: bigint): number {
  if (targetWei <= 0n) return 0;
  const progress = Number(totalRaisedWei) / Number(targetWei);
  return Math.min(1.0, Math.max(0, progress));
}

/**
 * Mirrors BondingCurve.sol decaying anti-snipe tax schedule.
 */
export function calculateAntiSnipeTaxBps(elapsedSeconds: number): bigint {
  if (elapsedSeconds >= 3) return 0n;
  if (elapsedSeconds <= 0) return 9900n; // 99%
  if (elapsedSeconds <= 1) return 2500n; // 25%
  return 300n; // 3%
}
