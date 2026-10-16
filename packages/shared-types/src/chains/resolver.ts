import { SUPPORTED_CHAINS, DEFAULT_NETWORK, CHAINS } from './registry';
import { ARC_CHAIN_ID } from './arc';
import type { NetworkConfig, TokenAddressPair } from './types';

/**
 * Checks whether a token belongs to a given network by matching
 * explicit chainId, pairedToken, poolAddress, curveAddress, or the network's knownAddresses.
 */
export function matchesNetwork(token: TokenAddressPair, network: NetworkConfig): boolean {
  if (token.chainId && token.chainId === network.chainId) {
    return true;
  }
  const paired = token.pairedToken?.toLowerCase();
  const pool = token.poolAddress?.toLowerCase();
  const curve = token.curveAddress?.toLowerCase();

  const weth = network.contracts.weth?.toLowerCase();
  if (weth && paired === weth) return true;

  const addresses = [
    network.contracts.factory,
    network.contracts.factoryV2 ?? network.contracts.factory,
    ...(network.knownAddresses ?? []),
  ]
    .filter(Boolean)
    .map((a) => a.toLowerCase());

  return addresses.some((a) => a === pool || a === curve);
}

/**
 * Resolves the appropriate NetworkConfig for a given token entity and/or active chain ID.
 * Iterates across all registered networks in the chain registry.
 */
export function resolveTokenNetwork(
  token?: TokenAddressPair | null,
  activeChainId?: number,
): NetworkConfig {
  if (token?.chainId && SUPPORTED_CHAINS[token.chainId]) {
    return SUPPORTED_CHAINS[token.chainId];
  }

  if (activeChainId && SUPPORTED_CHAINS[activeChainId] && !token) {
    return SUPPORTED_CHAINS[activeChainId];
  }

  if (token) {
    const match = CHAINS.find((net) => matchesNetwork(token, net));
    if (match) return match;
  }

  if (activeChainId && SUPPORTED_CHAINS[activeChainId]) {
    return SUPPORTED_CHAINS[activeChainId];
  }

  return DEFAULT_NETWORK;
}

/**
 * Returns true if the token belongs to Arc Network.
 * @deprecated Compare `resolveTokenNetwork(...).slug` instead; kept for backward compatibility.
 */
export function isArcToken(token?: TokenAddressPair | null, activeChainId?: number): boolean {
  return resolveTokenNetwork(token, activeChainId).chainId === ARC_CHAIN_ID;
}

/**
 * Resolves a network config from a route parameter: chain ID ('5042'), slug ('arc'),
 * display name ('arc network'), native symbol ('usdc'), or any declared alias.
 */
export function resolveNetworkByParam(param?: string | null): NetworkConfig {
  const p = (param || '').toLowerCase().trim();
  if (!p) return DEFAULT_NETWORK;

  const match = CHAINS.find((net) =>
    [
      String(net.chainId),
      net.slug,
      net.name,
      net.nativeCurrency.symbol,
      ...(net.aliases ?? []),
    ].some((key) => key.toLowerCase() === p),
  );

  return match ?? DEFAULT_NETWORK;
}
