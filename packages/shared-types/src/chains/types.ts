/**
 * Sentinel for a contract that has not yet been deployed on a given network.
 * Code that reads a contract address must check for this value and skip the call.
 * Never substitute a mainnet address for a missing deployment.
 */
export const UNDEPLOYED = '0x0000000000000000000000000000000000000000' as const;

/** Whether an address is set: present and not UNDEPLOYED (address(0)). */
export function isDeployed(address?: string | null): address is `0x${string}` {
  return Boolean(address) && address!.toLowerCase() !== UNDEPLOYED;
}

export interface NetworkConfig {
  chainId: number;
  /** Stable lowercase identifier used in routes, env prefixes and folder names (e.g. 'arc'). */
  slug: string;
  /** Extra route/query aliases resolved by `resolveNetworkByParam` besides slug, name, chainId and native symbol. */
  aliases?: readonly string[];
  /** Additional curve/pool addresses (legacy deployments) that identify a token as belonging to this chain. */
  knownAddresses?: readonly `0x${string}`[];
  name: string;
  icon?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  rpcUrls?: string[];
  /** Average block time; turns durations into block counts (indexer lag, backfill windows). */
  blockTimeMs: number;
  /** Widest eth_getLogs block span every RPC in `rpcUrls` accepts; history backfills stay within it. */
  maxLogBlockRange?: number;
  /** Pause between the requests of a history backfill, for RPCs that rate-limit eth_getLogs. */
  backfillRequestIntervalMs?: number;
  blockExplorer: string;
  /** Display name of `blockExplorer` (wallet chain metadata). */
  blockExplorerName: string;
  /** Decimals of `contracts.weth`, the ERC-20 quote of launch pools (6 for USDC on Arc). */
  quoteTokenDecimals: number;
  keeper: {
    /** Smallest accrued amount, in quote-token units, worth a keeper transaction. */
    minQuote: bigint;
    /** Native balance under which the keeper wallet needs a top-up. */
    minGasWei: bigint;
  };
  contracts: {
    factory: `0x${string}`;
    factoryV2?: `0x${string}`;
    locker: `0x${string}`;
    /** Optional: HolderFeeDistributor contract. Absent on chains that do not use holder fee sharing. */
    holderFeeDistributor?: `0x${string}`;
    /** Uniswap V3 periphery — only on chains that route through V3 (absent on Arc). */
    uniswapV3Factory?: `0x${string}`;
    positionManager?: `0x${string}`;
    swapRouter?: `0x${string}`;
    quoterV2?: `0x${string}`;
    /** Wrapped native / quote currency of launch pools (USDC ERC-20 on Arc). */
    weth: `0x${string}`;
    /** GotonV4Hook (singleton per chain). */
    memeHook?: `0x${string}`;
    /** GotonV4Graduator — moves graduated bonding curves into their v4 pool (bonding-curve chains). */
    graduator?: `0x${string}`;
    /** GotonV4Router — exact-input v4 swaps (native value for buys, exact approvals for sells). */
    router?: `0x${string}`;
    /** GotonV4Buyback — TWAP-guarded buyback-and-burn of each token's burn share. */
    buyback?: `0x${string}`;
    /** GotonLimitOrders — escrowed limit, take-profit and stop-loss orders. */
    limitOrders?: `0x${string}`;
    /** GotonTeamSplitterFactory: fixed team payouts for a creator's tax and fees. */
    teamSplitterFactory?: `0x${string}`;
    poolManagerV4?: `0x${string}`;
    positionManagerV4?: `0x${string}`;
    universalRouter?: `0x${string}`;
    permit2?: `0x${string}`;
    canonicalUsdc?: `0x${string}`;
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
    virtualReserveWei?: bigint;
    graduationTargetWei: bigint;
    platformFeeBps: number;
    snipeTaxMaxBps: number;
    minPrebuyWei?: bigint;
  };
}

export interface TokenAddressPair {
  pairedToken?: string;
  poolAddress?: string;
  curveAddress?: string;
  version?: string;
  chainId?: number;
}
