import { ROBINHOOD_MATH_CONFIG } from './robinhood';
import { ARC_MATH_CONFIG } from './arc';
import type { ChainMathConfig, LaunchModel } from './types';

/**
 * Every chain with bonding-curve math. To add a chain: create `./<slug>.ts`
 * exporting a `ChainMathConfig`, then append it here.
 */
export const CHAIN_MATH_CONFIGS: readonly ChainMathConfig[] = [
  ROBINHOOD_MATH_CONFIG,
  ARC_MATH_CONFIG,
];

export function getChainMathConfig(chainId: number): ChainMathConfig | undefined {
  return CHAIN_MATH_CONFIGS.find((c) => c.chainId === chainId);
}

/** A chain's launch model; chains without a math config are treated as bonding-curve chains. */
export function getLaunchModel(chainId: number): LaunchModel {
  return getChainMathConfig(chainId)?.model ?? 'bonding-curve';
}
