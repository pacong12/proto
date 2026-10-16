import { TOTAL_SUPPLY_NUM, TOTAL_SUPPLY_WEI } from '../constants';
import type { ChainMathConfig } from './types';

export const ROBINHOOD_GRADUATION_TARGET_WEI = 4_200_000_000_000_000_000n; // 4.2 ETH
export const ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI = 1_680_000_000_000_000_000n; // 1.68 ETH (Pons standard)

export const ROBINHOOD_CURVE_TOKEN_SUPPLY_NUM = 714_285_714;
export const ROBINHOOD_POOL_RESERVE_SUPPLY_NUM = 285_714_286;
export const ROBINHOOD_CURVE_TOKEN_SUPPLY_WEI = 714_285_714n * 10n ** 18n;
export const ROBINHOOD_POOL_RESERVE_SUPPLY_WEI = 285_714_286n * 10n ** 18n;

/**
 * Robinhood Chain (Chain ID: 4663) Math Specification
 *
 * Characteristics:
 * - Native gas / quote currency: ETH (18 decimals)
 * - Curve allocation: 71.43% (714,285,714 tokens)
 * - Pool reserve: 28.57% (285,714,286 tokens)
 * - Virtual ETH reserve: 1.68 ETH
 * - Graduation target: 4.20 ETH
 * - Opening spot price: 1.68 / 1,000,000,000 = 0.00000000168 ETH (~$0.00000437 at $2600 ETH)
 */
export const ROBINHOOD_MATH_CONFIG = {
  chainId: 4663,
  slug: 'robinhood',
  name: 'Robinhood Chain',
  model: 'bonding-curve',
  quoteSymbol: 'ETH',
  quoteDecimals: 18,
  totalSupply: TOTAL_SUPPLY_WEI,
  totalSupplyNum: TOTAL_SUPPLY_NUM,
  curveSupply: ROBINHOOD_CURVE_TOKEN_SUPPLY_WEI,
  curveSupplyNum: ROBINHOOD_CURVE_TOKEN_SUPPLY_NUM,
  poolSupply: ROBINHOOD_POOL_RESERVE_SUPPLY_WEI,
  poolSupplyNum: ROBINHOOD_POOL_RESERVE_SUPPLY_NUM,
  virtualQuoteReserve: ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI,
  graduationTarget: ROBINHOOD_GRADUATION_TARGET_WEI,
} as const satisfies ChainMathConfig;
