import { LaunchedTokenEntity, GraduationStatus, type NetworkConfig } from '@proto/shared-types';

/**
 * Port for reading on-chain state.
 * Implemented by ViemChainIndexerAdapter (multi-chain).
 */
export interface ChainIndexerPort {
  fetchLaunchedTokenFromChain(
    tokenAddress: `0x${string}`,
    networkConfig?: NetworkConfig,
  ): Promise<LaunchedTokenEntity | null>;

  fetchGraduationStatus(
    tokenAddress: `0x${string}`,
    networkConfig?: NetworkConfig,
  ): Promise<GraduationStatus>;

  fetchPoolSlot0(poolAddress: `0x${string}`): Promise<{ sqrtPriceX96: bigint; tick: number }>;
  fetchWethBalance(account: `0x${string}`): Promise<bigint>;
}
