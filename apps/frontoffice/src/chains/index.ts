import type { ChainAdapter } from './types';
import { arcChainAdapter } from './arc/arc.adapter';
import { robinhoodChainAdapter } from './robinhood/robinhood.adapter';
import { type TokenAddressPair, resolveTokenNetwork } from '@proto/shared-types';

export * from './types';
export * from './arc/arc.adapter';
export * from './robinhood/robinhood.adapter';

const chainAdapters = new Map<number, ChainAdapter>([
  [robinhoodChainAdapter.chainId, robinhoodChainAdapter],
  [arcChainAdapter.chainId, arcChainAdapter],
]);

/**
 * Register a new chain adapter dynamically.
 */
export function registerChainAdapter(adapter: ChainAdapter): void {
  chainAdapters.set(adapter.chainId, adapter);
}

/**
 * Returns the appropriate ChainAdapter for the given chain ID.
 */
export function getChainAdapter(chainId?: number): ChainAdapter {
  if (chainId && chainAdapters.has(chainId)) {
    return chainAdapters.get(chainId)!;
  }
  return robinhoodChainAdapter;
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
