import { ROBINHOOD_ABIS } from './robinhood';
import { ARC_ABIS } from './arc';
import type { ChainAbis } from './types';

/**
 * ABI sets per chain. The first entry is the fallback for unknown chain IDs.
 * To add a chain: create `./<slug>.ts` exporting a `ChainAbis`, then append it here.
 */
export const CHAIN_ABIS: readonly ChainAbis[] = [ROBINHOOD_ABIS, ARC_ABIS];

export function getChainAbis(chainId?: number): ChainAbis {
  return CHAIN_ABIS.find((c) => c.chainId === chainId) ?? CHAIN_ABIS[0];
}
