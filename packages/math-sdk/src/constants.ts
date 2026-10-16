/**
 * Canonical Protocol Constants for Proto Launchpad V2
 * Mirrors BondingCurve.sol, LiquidityLocker.sol, and HolderFeeDistributor.sol exactly.
 */

export const BPS = 10_000n;
export const TRADE_FEE_BPS = 100n; // 1.0% trade fee on bonding curve

// Token supply divisions (standard 18 decimals)
export const CURVE_TOKEN_SUPPLY_NUM = 800_000_000;
export const POOL_RESERVE_SUPPLY_NUM = 200_000_000;
export const TOTAL_SUPPLY_NUM = 1_000_000_000;

export const CURVE_TOKEN_SUPPLY_WEI = 800_000_000n * 10n ** 18n;
export const POOL_RESERVE_SUPPLY_WEI = 200_000_000n * 10n ** 18n;
export const TOTAL_SUPPLY_WEI = 1_000_000_000n * 10n ** 18n;

// Permanent 70/30 fee distribution splits
export const CREATOR_FEE_BPS = 7_000n; // 70% to token creator
export const HOLDER_FEE_BPS = 2_000n; // 20% pro-rata to token holders
export const BUYBACK_FEE_BPS = 1_000n; // 10% to automated buyback & burn

// Chain-specific parameters live in ./chains/<chain>.ts
