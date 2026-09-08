export interface TokenSocials {
  twitter?: string;
  telegram?: string;
  discord?: string;
  website?: string;
  farcaster?: string;
}

export interface LaunchedTokenEntity {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logo: string;
  description: string;
  socials: TokenSocials;
  deployer: `0x${string}`;
  pairedToken: `0x${string}`;
  poolAddress: `0x${string}`;
  isToken0: boolean;
  poolFee: number;
  positionId: bigint;
  restrictionsEndBlock: bigint;
  launchBlock: bigint;
  createdAt: number;
  initialBuyAmount?: string;
}

export interface TokenMarketData {
  address: `0x${string}`;
  priceInWeth: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  pairedPrincipalWeth: string;
  graduationThresholdWeth: string;
  graduationProgress: number; // 0.0 - 1.0
  isGraduated: boolean;
  volume24hUsd: number;
}

export interface GraduationStatus {
  pairedPrincipal: bigint;
  threshold: bigint;
  graduated: boolean;
  progress: number;
}

export interface FeeDistributionState {
  tokenAddress: `0x${string}`;
  positionId: bigint;
  deployer: `0x${string}`;
  redirectAddress?: `0x${string}`;
  protocolFeeSharePercent: number;
  creatorFeeSharePercent: number;
  unclaimedTokenFees: string;
  unclaimedWethFees: string;
}
