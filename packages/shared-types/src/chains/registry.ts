import { ROBINHOOD_NETWORK, ROBINHOOD_CHAIN_ID } from './robinhood';
import { ARC_NETWORK, ARC_CHAIN_ID } from './arc';
import type { NetworkConfig } from './types';

/**
 * Every supported network. The first entry is the default network.
 * To add a chain: create `./<slug>.ts` exporting a `NetworkConfig`, then append it here
 * (see README.md in this folder for the full cross-package checklist).
 */
export const CHAINS: readonly NetworkConfig[] = [ROBINHOOD_NETWORK, ARC_NETWORK];

export type SupportedChainId = typeof ROBINHOOD_CHAIN_ID | typeof ARC_CHAIN_ID | (number & {});

export const SUPPORTED_CHAINS: Record<number, NetworkConfig> = Object.fromEntries(
  CHAINS.map((net) => [net.chainId, net]),
);

export const DEFAULT_NETWORK: NetworkConfig = CHAINS[0];

export function getNetworkConfig(chainId?: number): NetworkConfig {
  if (chainId && SUPPORTED_CHAINS[chainId]) {
    return SUPPORTED_CHAINS[chainId];
  }
  return DEFAULT_NETWORK;
}
