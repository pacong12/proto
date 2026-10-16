/**
 * - `bonding-curve`: a dedicated BondingCurve contract sells `curveSupply`, then migrates.
 * - `v4-in-pool`: tokens trade in a Uniswap v4 pool from launch; the reserves below are the
 *   equivalent constant-product values of the locked launch position.
 */
export type LaunchModel = 'bonding-curve' | 'v4-in-pool';

/**
 * Curve math parameters every supported chain must declare.
 * Chain modules may add extra chain-specific fields on top of this shape.
 */
export interface ChainMathConfig {
  chainId: number;
  slug: string;
  name: string;
  model: LaunchModel;
  quoteSymbol: string;
  quoteDecimals: number;
  totalSupply: bigint;
  totalSupplyNum: number;
  curveSupply: bigint;
  curveSupplyNum: number;
  poolSupply: bigint;
  poolSupplyNum: number;
  virtualQuoteReserve: bigint;
  graduationTarget: bigint;
  minPrebuy?: bigint;
}
