export interface NetworkConfig {
  chainId: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  rpcUrls?: string[];
  blockExplorer: string;
  contracts: {
    factory: `0x${string}`;
    factoryV2?: `0x${string}`;
    locker: `0x${string}`;
    /** Optional: HolderFeeDistributor contract. Absent on chains that do not use holder fee sharing. */
    holderFeeDistributor?: `0x${string}`;
    uniswapV3Factory: `0x${string}`;
    positionManager: `0x${string}`;
    swapRouter: `0x${string}`;
    quoterV2: `0x${string}`;
    weth: `0x${string}`;
  };
  launchConfig: {
    supply: bigint;
    poolFee: number;
    launchFeeWei: bigint;
    graduationThresholdWei: bigint;
    antiSnipeBlocks: number;
    maxHoldPercent: number;
    maxBuyPercent: number;
    protocolFeeSharePercent: number;
    creatorFeeSharePercent: number;
  };
  launchConfigV2?: {
    supply: bigint;
    curveTokenAllocation: bigint;
    graduationTargetWei: bigint;
    platformFeeBps: number;
    snipeTaxMaxBps: number;
  };
}

import { ROBINHOOD_NETWORK } from '../chains/robinhood';
import { ARC_NETWORK, ARC_PROTO_CURVE_ADDRESS } from '../chains/arc';

// ---------------------------------------------------------------------------
// Mainnet: Robinhood Chain (Chain ID 4663)
// ---------------------------------------------------------------------------

export const ROBINHOOD_CHAIN: NetworkConfig = ROBINHOOD_NETWORK;

// ---------------------------------------------------------------------------
// Mainnet: Arc Network (Chain ID 5042) - Circle Stablecoin L1
// Production Proto launchpad infrastructure on Arc Network
// ---------------------------------------------------------------------------

export const ARC_CHAIN: NetworkConfig = ARC_NETWORK;

export { ARC_PROTO_CURVE_ADDRESS };

export const SUPPORTED_CHAINS: Record<number, NetworkConfig> = {
  [ROBINHOOD_CHAIN.chainId]: ROBINHOOD_CHAIN,
  [ARC_CHAIN.chainId]: ARC_CHAIN,
};

export const DEFAULT_NETWORK: NetworkConfig = ROBINHOOD_CHAIN;

export function getNetworkConfig(chainId?: number): NetworkConfig {
  if (chainId && SUPPORTED_CHAINS[chainId]) {
    return SUPPORTED_CHAINS[chainId];
  }
  return DEFAULT_NETWORK;
}
