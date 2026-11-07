export interface ProfileStorageData {
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  twitter: string;
  telegram: string;
}

export interface MyLaunchItem {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  /** Accrued creator fees, formatted, in `currencySymbol`. */
  unclaimedWeth: string;
  /** Null when the read failed: unknown, not zero, so the claim stays possible. */
  unclaimedRaw: bigint | null;
  quoteDecimals: number;
  /** The currency of the token's chain: tokens of one creator can quote in different ones. */
  currencySymbol: string;
  redirect: string | null;
  /** Fees accrue to the curve until graduation; a pool token has no curve and accrues from launch. */
  onBondingCurve?: boolean;
  taxConfig?: {
    buyTaxBps?: number;
    sellTaxBps?: number;
    taxRecipient?: string;
    revenueSplit?: {
      creator: number;
      buyback: number;
      holders: number;
      growth: number;
    };
  };
}

export interface PortfolioPosition {
  tokenAddress: string;
  name: string;
  symbol: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
}

export interface UserActivity {
  txHash: string;
  isBuy: boolean;
  tokenSymbol: string;
  ethAmount: string;
  /** The quote currency and explorer of the token's chain. */
  currencySymbol: string;
  blockExplorer: string;
  tokenAmount: string;
  timestamp: number;
}
