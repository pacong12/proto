export interface ProfileStorageData {
  displayName: string;
  bio: string;
  avatarUrl: string;
  twitter: string;
  telegram: string;
}

export interface MyLaunchItem {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  version?: 'v1' | 'v2';
  unclaimedWeth: string;
  redirect: string | null;
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
  tokenAmount: string;
  timestamp: number;
}
