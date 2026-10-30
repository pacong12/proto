import {
  LaunchedTokenEntity,
  GraduationStatus,
  type CurveState,
  type NetworkConfig,
} from '@goton/shared-types';

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

  /** A token launched by a V2 factory, read from its bonding curve. */
  fetchV2LaunchedToken(
    tokenAddress: `0x${string}`,
    curveAddress: `0x${string}`,
    networkConfig: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null>;

  /** A token launched straight into its v4 pool (in-pool launch model). */
  fetchV4LaunchedToken(
    tokenAddress: `0x${string}`,
    poolId: `0x${string}`,
    creator: `0x${string}`,
    prebuyQuote: bigint,
    networkConfig: NetworkConfig,
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
  fetchV2CurveState(curveAddress: `0x${string}`, networkConfig: NetworkConfig): Promise<CurveState>;
}
