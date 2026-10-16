import {
  type NetworkConfig,
  getNetworkConfig,
  resolveTokenNetwork,
  type TokenAddressPair,
  type LaunchedTokenEntity,
} from '@goton/shared-types';

/**
 * Returns the chain badge icon path for any given NetworkConfig or chain ID.
 * Scalable: reads `network.icon` directly from the registered config.
 */
export function getChainIcon(
  networkOrChainId?: NetworkConfig | number | { chainId: number } | null,
): string {
  if (!networkOrChainId) return '/chains/robinhood.svg';
  const chainId =
    typeof networkOrChainId === 'number' ? networkOrChainId : networkOrChainId.chainId;
  const net = getNetworkConfig(chainId);
  return net.icon ?? '/chains/robinhood.svg';
}

/**
 * Returns the human-readable display name for any given NetworkConfig or chain ID.
 */
export function getChainName(
  networkOrChainId?: NetworkConfig | number | { chainId: number } | null,
): string {
  if (!networkOrChainId) return 'Robinhood Chain';
  const chainId =
    typeof networkOrChainId === 'number' ? networkOrChainId : networkOrChainId.chainId;
  const net = getNetworkConfig(chainId);
  return net.name;
}

/**
 * Returns the short display name for any given NetworkConfig or chain ID.
 */
export function getChainShortName(
  networkOrChainId?: NetworkConfig | number | { chainId: number } | null,
): string {
  if (!networkOrChainId) return 'Robinhood';
  const chainId =
    typeof networkOrChainId === 'number' ? networkOrChainId : networkOrChainId.chainId;
  const net = getNetworkConfig(chainId);
  return net.name.replace(/\s+(Chain|Network|Mainnet)$/i, '');
}

/**
 * Resolves the chain icon for any token entity or contract address.
 */
export function getTokenChainIcon(
  tokenOrAddress: string | LaunchedTokenEntity | TokenAddressPair | null | undefined,
  activeChainId?: number,
): string {
  const net =
    typeof tokenOrAddress === 'string'
      ? resolveTokenNetwork(
          { pairedToken: tokenOrAddress, poolAddress: tokenOrAddress },
          activeChainId,
        )
      : resolveTokenNetwork(tokenOrAddress, activeChainId);
  return getChainIcon(net);
}

/**
 * Resolves the chain name for any token entity or contract address.
 */
export function getTokenChainName(
  tokenOrAddress: string | LaunchedTokenEntity | TokenAddressPair | null | undefined,
  activeChainId?: number,
): string {
  const net =
    typeof tokenOrAddress === 'string'
      ? resolveTokenNetwork(
          { pairedToken: tokenOrAddress, poolAddress: tokenOrAddress },
          activeChainId,
        )
      : resolveTokenNetwork(tokenOrAddress, activeChainId);
  return getChainName(net);
}
