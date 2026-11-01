import type { ChainAdapter } from './types';
import { BondingCurveChainAdapter } from './bonding-curve/bonding-curve.adapter';
import { InPoolV4ChainAdapter } from './v4-in-pool/v4-in-pool.adapter';
import {
  CHAINS,
  DEFAULT_NETWORK,
  type NetworkConfig,
  type TokenAddressPair,
  resolveTokenNetwork,
} from '@goton/shared-types';
import { getLaunchModel, type LaunchModel } from '@goton/math-sdk';

export * from './types';
export * from './bonding-curve/bonding-curve.adapter';
export * from './v4-in-pool/v4-in-pool.adapter';

/** The adapter of each launch model; a chain's model comes from its math config. */
const ADAPTER_FOR_MODEL: Record<LaunchModel, (network: NetworkConfig) => ChainAdapter> = {
  'bonding-curve': (network) => new BondingCurveChainAdapter(network),
  'v4-in-pool': (network) => new InPoolV4ChainAdapter(network),
};

const chainAdapters = new Map<number, ChainAdapter>(
  CHAINS.map((network) => [
    network.chainId,
    ADAPTER_FOR_MODEL[getLaunchModel(network.chainId)](network),
  ]),
);

/**
 * Returns the ChainAdapter for the given chain ID, or the default network's.
 */
export function getChainAdapter(chainId?: number): ChainAdapter {
  return (
    (chainId !== undefined ? chainAdapters.get(chainId) : undefined) ??
    chainAdapters.get(DEFAULT_NETWORK.chainId)!
  );
}

/**
 * Resolves the appropriate ChainAdapter for a given token entity and active wallet chain.
 * Scalable: determines the token network first, then retrieves its registered adapter.
 */
export function resolveTokenChainAdapter(
  token?: TokenAddressPair | null,
  activeChainId?: number,
): ChainAdapter {
  const network = resolveTokenNetwork(token, activeChainId);
  return getChainAdapter(network.chainId);
}
