import { ROBINHOOD_ABIS } from './robinhood';
import { ARC_ABIS } from './arc';
import type { ChainAbis } from './types';

/**
 * ABI sets per chain. The first entry is the fallback for unknown chain IDs.
 * To add a chain: create `./<slug>.ts` exporting a `ChainAbis`, then append it here.
 */
/** Arc testnet shares Arc's contracts and ABIs. */
export const ARC_TESTNET_CHAIN_ID = 5042002;

export const CHAIN_ABIS: readonly ChainAbis[] = [
  ROBINHOOD_ABIS,
  ARC_ABIS,
  { ...ARC_ABIS, chainId: ARC_TESTNET_CHAIN_ID },
];

export function getChainAbis(chainId?: number): ChainAbis {
  return CHAIN_ABIS.find((c) => c.chainId === chainId) ?? CHAIN_ABIS[0];
}
