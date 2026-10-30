import type { PublicClient, WalletClient } from 'viem';
import type { TokenSocials, NetworkConfig } from '@goton/shared-types';

export interface ChainLaunchParams {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: TokenSocials;
  initialBuyAmountEth?: string;
  minInitialTokensOut?: bigint;
  buyTaxPercent?: number;
  sellTaxPercent?: number;
  creatorTaxWallet?: `0x${string}`;
  /** UI revenue split percentages (creator / buyback / holders / growth). */
  revenueSplit?: { creator: number; buyback: number; holders: number; growth: number };
}

export interface ChainLaunchResult {
  tokenAddress: `0x${string}`;
  /** Bonding curve address, or the Uniswap v4 pool id for in-pool launches. */
  poolAddress?: `0x${string}`;
  curveAddress?: `0x${string}`;
  /** Whether the requested creator tax is live on-chain (only then is it synced to the API). */
  taxApplied?: boolean;
  /** Whether the requested revenue split is recorded on-chain (false = default split applies). */
  splitApplied?: boolean;
}

export interface ChainSwapParams {
  tokenAddress: `0x${string}`;
  isBuy: boolean;
  amountInWei: bigint;
  slippagePercent: number;
  expectedAmountOut?: bigint;
  amountOutMinimum?: bigint;
  curveAddress?: `0x${string}`;
  isGraduated?: boolean;
  onSubmitted?: (txHash: `0x${string}`) => void;
  onApproveSubmitted?: (approveHash: `0x${string}`) => void;
}

export interface ChainAdapter {
  readonly network: NetworkConfig;
  readonly chainId: number;

  launchToken(
    params: ChainLaunchParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
    onHashEmitted?: (hash: `0x${string}`) => void,
  ): Promise<ChainLaunchResult | null>;

  /**
   * Records the revenue split for a token launched in a separate transaction (Robinhood Chain).
   * Only possible before the first third-party buy. Absent where the split is part of the launch.
   */
  applyRevenueSplit?(
    tokenAddress: `0x${string}`,
    revenueSplit: NonNullable<ChainLaunchParams['revenueSplit']>,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<boolean>;

  executeSwap(
    params: ChainSwapParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<string | null>;
}
