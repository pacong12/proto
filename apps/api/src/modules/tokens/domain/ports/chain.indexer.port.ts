import { LaunchedTokenEntity, GraduationStatus, type NetworkConfig } from '@proto/shared-types';

/** Shape of on-chain V2 bonding-curve state returned by the indexer. */
export interface V2CurveState {
  totalEthRaised: bigint;
  virtualEthReserve: bigint;
  virtualTokenReserve: bigint;
  graduationTarget: bigint;
  graduated: boolean;
}

/**
 * Port for reading on-chain state.
 * Implemented by ViemChainIndexerAdapter (multi-chain).
 * Application use-cases depend on this interface — never on the concrete adapter.
 */
export interface ChainIndexerPort {
  fetchLaunchedTokenFromChain(
    tokenAddress: `0x${string}`,
    networkConfig?: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null>;

  fetchV2LaunchedTokenFromFactory?(
    tokenAddress: `0x${string}`,
    networkConfig?: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null>;

  fetchGraduationStatus(
    tokenAddress: `0x${string}`,
    networkConfig?: NetworkConfig,
  ): Promise<GraduationStatus>;

  fetchPoolSlot0(poolAddress: `0x${string}`): Promise<{ sqrtPriceX96: bigint; tick: number }>;
  fetchWethBalance(account: `0x${string}`): Promise<bigint>;

  /** Reads live reserve + graduation state directly from the bonding-curve contract. */
  fetchV2CurveState(
    curveAddress: `0x${string}`,
    networkConfig: NetworkConfig,
  ): Promise<V2CurveState>;
}
