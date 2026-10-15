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

// Canonical graduation targets
export const ROBINHOOD_GRADUATION_TARGET_WEI = 4_200_000_000_000_000_000n; // 4.2 ETH
export const ARC_GRADUATION_TARGET_WEI = 69_000n * 10n ** 18n; // 69,000 USDC

// Default initial virtual reserve baselines
export const ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI = 1_680_000_000_000_000_000n; // 1.68 ETH (Pons standard)
export const ARC_INITIAL_VIRTUAL_ETH_WEI = 24_420n * 10n ** 18n; // 24,420 USDC (Arc/Argus standard)

// Network specific curve and pool allocations
export const ROBINHOOD_CURVE_TOKEN_SUPPLY_NUM = 714_285_714;
export const ROBINHOOD_POOL_RESERVE_SUPPLY_NUM = 285_714_286;
export const ROBINHOOD_CURVE_TOKEN_SUPPLY_WEI = 714_285_714n * 10n ** 18n;
export const ROBINHOOD_POOL_RESERVE_SUPPLY_WEI = 285_714_286n * 10n ** 18n;

export const ARC_CURVE_TOKEN_SUPPLY_NUM = 738_600_000;
export const ARC_POOL_RESERVE_SUPPLY_NUM = 261_400_000;
export const ARC_CURVE_TOKEN_SUPPLY_WEI = 738_600_000n * 10n ** 18n;
export const ARC_POOL_RESERVE_SUPPLY_WEI = 261_400_000n * 10n ** 18n;
