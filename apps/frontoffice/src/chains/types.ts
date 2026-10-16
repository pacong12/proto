import type { PublicClient, WalletClient } from 'viem';
import type { TokenSocials, NetworkConfig } from '@proto/shared-types';

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
  readonly isArc?: boolean;

  launchToken(
    params: ChainLaunchParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
    onHashEmitted?: (hash: `0x${string}`) => void,
  ): Promise<ChainLaunchResult | null>;

  executeSwap(
    params: ChainSwapParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<string | null>;
}
