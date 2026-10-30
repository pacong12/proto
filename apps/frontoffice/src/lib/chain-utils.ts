import {
  type NetworkConfig,
  getNetworkConfig,
  resolveTokenNetwork,
  type TokenAddressPair,
  type LaunchedTokenEntity,
} from '@goton/shared-types';

type ChainRef = NetworkConfig | number | { chainId: number } | null | undefined;

/** The registered network for a config or chain ID; the default network when absent or unknown. */
function networkOf(ref: ChainRef): NetworkConfig {
  return getNetworkConfig(typeof ref === 'number' ? ref : ref?.chainId);
}

/** The network of a token entity, or of a bare contract address (paired token or pool). */
function tokenNetworkOf(
  tokenOrAddress: string | LaunchedTokenEntity | TokenAddressPair | null | undefined,
  activeChainId?: number,
): NetworkConfig {
  return typeof tokenOrAddress === 'string'
    ? resolveTokenNetwork(
        { pairedToken: tokenOrAddress, poolAddress: tokenOrAddress },
        activeChainId,
      )
    : resolveTokenNetwork(tokenOrAddress, activeChainId);
}

/**
 * Returns the chain badge icon path for any given NetworkConfig or chain ID.
 * Scalable: reads `network.icon` directly from the registered config.
 */
export function getChainIcon(networkOrChainId?: ChainRef): string {
  return networkOf(networkOrChainId).icon ?? '';
}

/**
 * Returns the human-readable display name for any given NetworkConfig or chain ID.
 */
export function getChainName(networkOrChainId?: ChainRef): string {
  return networkOf(networkOrChainId).name;
}

/**
 * Returns the short display name for any given NetworkConfig or chain ID.
 */
export function getChainShortName(networkOrChainId?: ChainRef): string {
  return networkOf(networkOrChainId).name.replace(/\s+(Chain|Network|Mainnet)$/i, '');
}

/**
 * Resolves the chain icon for any token entity or contract address.
 */
export function getTokenChainIcon(
  tokenOrAddress: string | LaunchedTokenEntity | TokenAddressPair | null | undefined,
  activeChainId?: number,
): string {
  return getChainIcon(tokenNetworkOf(tokenOrAddress, activeChainId));
}

/**
 * Resolves the chain name for any token entity or contract address.
 */
export function getTokenChainName(
  tokenOrAddress: string | LaunchedTokenEntity | TokenAddressPair | null | undefined,
  activeChainId?: number,
): string {
  return getChainName(tokenNetworkOf(tokenOrAddress, activeChainId));
}
