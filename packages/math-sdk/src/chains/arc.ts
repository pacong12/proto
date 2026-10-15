import {
  TOTAL_SUPPLY_NUM,
  TOTAL_SUPPLY_WEI,
  ARC_GRADUATION_TARGET_WEI,
  ARC_INITIAL_VIRTUAL_ETH_WEI,
  ARC_CURVE_TOKEN_SUPPLY_NUM,
  ARC_POOL_RESERVE_SUPPLY_NUM,
  ARC_CURVE_TOKEN_SUPPLY_WEI,
  ARC_POOL_RESERVE_SUPPLY_WEI,
} from '../constants';

/**
 * Arc Network (Chain ID: 5042) Math Specification
 *
 * Characteristics:
 * - Native gas / quote currency: USDC (18 decimals in native msg.value, 1 ether = 1.00 USDC)
 * - Curve allocation: 73.86% (738,600,000 tokens)
 * - Pool reserve: 26.14% (261,400,000 tokens)
 * - Virtual USDC reserve: 24,420 USDC
 * - Graduation target: 69,000 USDC
 * - Opening spot price: 24,420 / 1,000,000,000 = $0.00002442 USDC
 */
export const ARC_MATH_CONFIG = {
  chainId: 5042,
  name: 'Arc Network',
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
} as const;
