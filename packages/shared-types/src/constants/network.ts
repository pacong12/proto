/**
 * Backward-compatible network exports. Chain definitions live in `../chains/<slug>.ts`
 * and are registered in `../chains/registry.ts`.
 */
import { ROBINHOOD_NETWORK } from '../chains/robinhood';
import { ARC_NETWORK } from '../chains/arc';
import type { NetworkConfig } from '../chains/types';

export { UNDEPLOYED } from '../chains/types';
export type { NetworkConfig } from '../chains/types';
export { SUPPORTED_CHAINS, DEFAULT_NETWORK, getNetworkConfig } from '../chains/registry';
export { ARC_PROTO_CURVE_ADDRESS } from '../chains/arc';

export const ROBINHOOD_CHAIN: NetworkConfig = ROBINHOOD_NETWORK;
export const ARC_CHAIN: NetworkConfig = ARC_NETWORK;
