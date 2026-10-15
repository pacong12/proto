import { SUPPORTED_CHAINS, DEFAULT_NETWORK } from '../constants/network';
import { ARC_NETWORK, ARC_PROTO_CURVE_ADDRESS } from './arc';
import { ROBINHOOD_NETWORK } from './robinhood';
import type { TokenAddressPair } from './types';
import type { NetworkConfig } from '../constants/network';

/**
 * Checks whether a token belongs to a given network by matching
 * explicit chainId, pairedToken, poolAddress, or curveAddress.
 */
export function matchesNetwork(token: TokenAddressPair, network: NetworkConfig): boolean {
  if (token.chainId && token.chainId === network.chainId) {
    return true;
  }
  const paired = token.pairedToken?.toLowerCase();
  const pool = token.poolAddress?.toLowerCase();
  const curve = token.curveAddress?.toLowerCase();

  const weth = network.contracts.weth?.toLowerCase();
  const factory = network.contracts.factory?.toLowerCase();
  const factoryV2 = (network.contracts.factoryV2 ?? network.contracts.factory)?.toLowerCase();

  return (
    (!!weth && paired === weth) ||
    (!!factory && pool === factory) ||
    (!!factoryV2 && pool === factoryV2) ||
    (!!factory && curve === factory) ||
    (!!factoryV2 && curve === factoryV2) ||
    (network.chainId === ARC_NETWORK.chainId &&
      (curve === ARC_PROTO_CURVE_ADDRESS.toLowerCase() ||
        pool === '0x00689b589add3ee1995e26e7f4e5cbf262486eb4'))
  );
}

/**
 * Resolves the appropriate NetworkConfig for a given token entity and/or active chain ID.
 * Scalable: iterates across all registered networks in SUPPORTED_CHAINS.
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
    for (const net of Object.values(SUPPORTED_CHAINS)) {
      if (matchesNetwork(token, net)) {
        return net;
      }
    }
  }

  if (activeChainId && SUPPORTED_CHAINS[activeChainId]) {
    return SUPPORTED_CHAINS[activeChainId];
  }

  return DEFAULT_NETWORK;
}

/**
 * Returns true if the token belongs to Arc Network (retained for backward compatibility).
 */
export function isArcToken(token?: TokenAddressPair | null, activeChainId?: number): boolean {
  return resolveTokenNetwork(token, activeChainId).chainId === ARC_NETWORK.chainId;
}

/**
 * Resolves a network config from a route parameter string (e.g., 'arc', 'robinhood', '5042', '4663').
 */
export function resolveNetworkByParam(param?: string | null): NetworkConfig {
  const p = (param || '').toLowerCase().trim();
  if (!p) return DEFAULT_NETWORK;

  for (const net of Object.values(SUPPORTED_CHAINS)) {
    if (
      p === String(net.chainId) ||
      p === net.name.toLowerCase() ||
      p === net.nativeCurrency.symbol.toLowerCase() ||
      (net.chainId === ARC_NETWORK.chainId && p === 'arc') ||
      (net.chainId === ROBINHOOD_NETWORK.chainId && p === 'robinhood')
    ) {
      return net;
    }
  }

  return DEFAULT_NETWORK;
}
