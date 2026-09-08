import { LaunchedTokenEntity, GraduationStatus } from '@proto/shared-types';

export interface ChainIndexerPort {
  fetchLaunchedTokenFromChain(tokenAddress: `0x${string}`): Promise<LaunchedTokenEntity | null>;
  fetchGraduationStatus(tokenAddress: `0x${string}`): Promise<GraduationStatus>;
  fetchPoolSlot0(poolAddress: `0x${string}`): Promise<{ sqrtPriceX96: bigint; tick: number }>;
  fetchWethBalance(account: `0x${string}`): Promise<bigint>;
}
