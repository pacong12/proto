import type { ChainAdapter } from './types';
import { arcChainAdapter } from './arc/arc.adapter';
import { robinhoodChainAdapter } from './robinhood/robinhood.adapter';
import { ARC_CHAIN, type TokenAddressPair, isArcToken } from '@proto/shared-types';

export * from './types';
export * from './arc/arc.adapter';
export * from './robinhood/robinhood.adapter';

/**
 * Returns the appropriate ChainAdapter for the given chain ID.
 */
export function getChainAdapter(chainId?: number): ChainAdapter {
  if (chainId === ARC_CHAIN.chainId) {
    return arcChainAdapter;
  }
  return robinhoodChainAdapter;
}

/**
 * Resolves the appropriate ChainAdapter for a given token entity and active wallet chain.
 */
export function resolveTokenChainAdapter(
  token?: TokenAddressPair | null,
  activeChainId?: number,
): ChainAdapter {
  if (isArcToken(token, activeChainId)) {
    return arcChainAdapter;
  }
  return robinhoodChainAdapter;
}
