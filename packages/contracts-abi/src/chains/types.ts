import type { Abi } from 'viem';

/**
 * ABI set every supported chain must provide. Contracts that only exist in one launch
 * model (bonding curve vs. in-pool Uniswap v4) are optional; chain modules may add more.
 */
export interface ChainAbis {
  chainId: number;
  slug: string;
  factoryV2: Abi;
  token: Abi;
  vestingVault: Abi;
  bondingCurve?: Abi;
  locker?: Abi;
  holderFeeDistributor?: Abi;
  memeHook?: Abi;
  feeSplitter?: Abi;
  /** Moves graduated bonding curves into their Uniswap v4 pool (bonding-curve chains). */
  graduator?: Abi;
  /** Goton's exact-input v4 swap router. */
  router?: Abi;
  /** TWAP-guarded buyback-and-burn for v4 pools. */
  buyback?: Abi;
}
