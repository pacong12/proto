import { TOTAL_SUPPLY_NUM, TOTAL_SUPPLY_WEI } from '../constants';
import type { ChainMathConfig } from './types';

/**
 * Arc Network launches go straight into a Uniswap v4 pool (Argus portal model): 100% of supply
 * is single-sided liquidity over [ARC_TICK_LOWER, ARC_INITIAL_TICK] with USDC as currency0.
 * Within that range the pool behaves exactly like x * y = k with the virtual reserves below,
 * so the generic bonding-curve helpers apply (pass the 1% pool fee + token tax as fees).
 *
 * Amounts suffixed `_WEI` use 18 decimals (native USDC msg.value); `_USDC6` use the
 * 6-decimal USDC ERC-20 at 0x3600….
 */

// Pool parameters (LaunchpadV2FactoryArc / Argus portal)
export const ARC_INITIAL_TICK = 405_400; // opening market cap ≈ $2,480.74
export const ARC_BOND_TICK = 376_400; // graduation market cap ≈ $45,078.87
export const ARC_TICK_LOWER = -887_200;
export const ARC_TICK_SPACING = 200;
export const ARC_POOL_FEE_PIPS = 10_000; // 1%
export const ARC_INITIAL_SQRT_PRICE_X96 = 50302388120867331857465247907496697271n;
export const ARC_BOND_SQRT_PRICE_X96 = 11800301107109846379556182205197121619n;
/** Liquidity of the locked launch position (matches Argus $GOLDETTF on-chain). */
export const ARC_LAUNCH_LIQUIDITY = 1575037795897358225n;

export const ARC_OPENING_FDV_USDC = 2_480.744058;
export const ARC_GRADUATION_FDV_USDC = 45_078.87;

// Launch rules
export const ARC_MIN_PREBUY_USDC6 = 4_500_000n; // 4.50 USDC
export const ARC_MIN_PREBUY_WEI = ARC_MIN_PREBUY_USDC6 * 10n ** 12n;
export const ARC_MAX_DEV_BUY_BPS = 500; // 5% of supply
export const ARC_PROTOCOL_FEE_BPS = 3_000; // protocol cut of every tax payment
export const ARC_MAX_TAX_BPS = 1_000; // per side, fixed forever

// Equivalent constant-product reserves (pre-fee), derived from ARC_LAUNCH_LIQUIDITY
export const ARC_INITIAL_VIRTUAL_ETH_WEI = 2_480_744_058n * 10n ** 12n; // 2,480.744058 USDC
export const ARC_GRADUATION_TARGET_WEI = 8_094_185_287n * 10n ** 12n; // USDC bought to reach ARC_BOND_TICK
// Tokens bought by graduation: the launch position's token (currency1) delta between the opening
// and bond prices, L * (sqrtP_open - sqrtP_bond) / 2^96 (= 765,412,706.08 tokens).
export const ARC_CURVE_TOKEN_SUPPLY_WEI =
  (ARC_LAUNCH_LIQUIDITY * (ARC_INITIAL_SQRT_PRICE_X96 - ARC_BOND_SQRT_PRICE_X96)) / 2n ** 96n;
export const ARC_POOL_RESERVE_SUPPLY_WEI = TOTAL_SUPPLY_WEI - ARC_CURVE_TOKEN_SUPPLY_WEI;
export const ARC_CURVE_TOKEN_SUPPLY_NUM = 765_412_706;
export const ARC_POOL_RESERVE_SUPPLY_NUM = TOTAL_SUPPLY_NUM - ARC_CURVE_TOKEN_SUPPLY_NUM;

/**
 * Arc Network (Chain ID: 5042) Math Specification — in-pool Uniswap v4, no bonding-curve contract.
 */
export const ARC_MATH_CONFIG = {
  chainId: 5042,
  slug: 'arc',
  name: 'Arc Network',
  model: 'v4-in-pool',
  quoteSymbol: 'USDC',
  quoteDecimals: 18,
  totalSupply: TOTAL_SUPPLY_WEI,
  totalSupplyNum: TOTAL_SUPPLY_NUM,
  curveSupply: ARC_CURVE_TOKEN_SUPPLY_WEI,
  curveSupplyNum: ARC_CURVE_TOKEN_SUPPLY_NUM,
  poolSupply: ARC_POOL_RESERVE_SUPPLY_WEI,
  poolSupplyNum: ARC_POOL_RESERVE_SUPPLY_NUM,
  virtualQuoteReserve: ARC_INITIAL_VIRTUAL_ETH_WEI,
  graduationTarget: ARC_GRADUATION_TARGET_WEI,
  minPrebuy: ARC_MIN_PREBUY_WEI,
  initialTick: ARC_INITIAL_TICK,
  bondTick: ARC_BOND_TICK,
  tickLower: ARC_TICK_LOWER,
  tickSpacing: ARC_TICK_SPACING,
  poolFeePips: ARC_POOL_FEE_PIPS,
  initialSqrtPriceX96: ARC_INITIAL_SQRT_PRICE_X96,
  launchLiquidity: ARC_LAUNCH_LIQUIDITY,
  openingFdvUsdc: ARC_OPENING_FDV_USDC,
  graduationFdvUsdc: ARC_GRADUATION_FDV_USDC,
  maxDevBuyBps: ARC_MAX_DEV_BUY_BPS,
  protocolFeeBps: ARC_PROTOCOL_FEE_BPS,
  maxTaxBps: ARC_MAX_TAX_BPS,
} as const;
ARC_MATH_CONFIG satisfies ChainMathConfig;

/**
 * Converts a Uniswap v4 tick of an Arc USDC (6 dec) / token (18 dec) pool to the token price in USDC.
 * @param quoteIsCurrency0 true when USDC sorts first (price = token1/token0 = tokens per USDC).
 */
export function calculateArcV4TickPriceUsdc(tick: number, quoteIsCurrency0 = true): number {
  const rawPrice = Math.pow(1.0001, tick);
  if (rawPrice <= 0) return 0;
  return quoteIsCurrency0 ? 1e12 / rawPrice : rawPrice * 1e12;
}

/**
 * Calculates FDV in USDC on Arc Network for a given tick.
 */
export function calculateArcV4FdvUsdc(
  tick: number,
  totalSupplyTokens = TOTAL_SUPPLY_NUM,
  quoteIsCurrency0 = true,
): number {
  return calculateArcV4TickPriceUsdc(tick, quoteIsCurrency0) * totalSupplyTokens;
}
