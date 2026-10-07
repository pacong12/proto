import { ROBINHOOD_NETWORK } from './robinhood';
import { ARC_NETWORK, ARC_PROTO_CURVE_ADDRESS } from './arc';
import type { TokenAddressPair } from './types';
import type { NetworkConfig } from '../constants/network';

/**
 * Returns true if the token belongs to Arc Network by matching
 * paired token (native USDC standard), pool address, or curve address.
 */
export function isArcToken(token?: TokenAddressPair | null, activeChainId?: number): boolean {
  if (!token) return activeChainId === ARC_NETWORK.chainId;

  const paired = token.pairedToken?.toLowerCase();
  const pool = token.poolAddress?.toLowerCase();
  const curve = token.curveAddress?.toLowerCase();

  const arcWeth = ARC_NETWORK.contracts.weth.toLowerCase();
  const arcFactory = ARC_NETWORK.contracts.factory.toLowerCase();
  const arcFactoryV2 = (
    ARC_NETWORK.contracts.factoryV2 ?? ARC_NETWORK.contracts.factory
  ).toLowerCase();

  return (
    paired === arcWeth ||
    pool === arcFactory ||
    pool === arcFactoryV2 ||
    curve === arcFactory ||
    curve === arcFactoryV2 ||
    curve === ARC_PROTO_CURVE_ADDRESS.toLowerCase() ||
    pool === '0x00689b589add3ee1995e26e7f4e5cbf262486eb4' ||
    (token.version === 'v2' && activeChainId === ARC_NETWORK.chainId)
  );
}

/**
 * Resolves the appropriate NetworkConfig for a given token entity.
 */
export function resolveTokenNetwork(
  token?: TokenAddressPair | null,
  activeChainId?: number,
): NetworkConfig {
  if (isArcToken(token, activeChainId)) {
    return ARC_NETWORK;
  }
  return ROBINHOOD_NETWORK;
}

/**
 * Resolves a network config from a route parameter string (e.g., 'arc', 'robinhood', '5042', '4663').
 */
export function resolveNetworkByParam(param?: string | null): NetworkConfig {
  const p = (param || '').toLowerCase();
  if (p === 'arc' || p === '5042') return ARC_NETWORK;
  return ROBINHOOD_NETWORK;
}
