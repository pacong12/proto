import type { MarketData } from '@goton/math-sdk';

export interface TokenSocials {
  twitter?: string;
  telegram?: string;
  discord?: string;
  website?: string;
  farcaster?: string;
}

export interface TokenTaxConfig {
  buyTaxBps?: number; // Base points (100 = 1%)
  sellTaxBps?: number;
  taxRecipient?: `0x${string}`;
  revenueSplit?: {
    creator: number;
    buyback: number;
    holders: number;
    growth: number;
  };
}
/**
 * Launch architecture version.
 * - `'v2'` — Pure Bonding Curve (active, all new tokens)
 * - `'v1'` — @deprecated Direct Uniswap V3 pool (legacy only; no new tokens created with V1)
 *            Kept in the type so existing DB rows with `version: 'v1'` can still be read.
 */
/** v1: V3 factory · v2: bonding curve · v4: in-pool Uniswap v4 launch */
export type LaunchVersion = 'v1' | 'v2' | 'v4';

export interface LaunchedTokenEntity {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logo: string;
  description: string;
  socials: TokenSocials;
  taxConfig?: TokenTaxConfig;
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
  version?: LaunchVersion;
  curveAddress?: `0x${string}`;
  isGraduated?: boolean;
  chainId?: number;
  // V2 bonding curve on-chain parameters (stored to avoid repeat RPC calls)
  virtualEthReserve?: string; // wei as string
  virtualTokenReserve?: string; // wei as string
  graduationTarget?: string; // wei as string
}

/** A token's market snapshot, as `calculateMarketData` (@goton/math-sdk) prices it. */
export interface TokenMarketData extends MarketData {
  priceChange24h?: number; // Percentage change over last 24h (optional, computed externally)
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

export interface TradeEventEntity {
  id: string;
  tokenAddress: `0x${string}`;
  poolAddress: `0x${string}`;
  trader: `0x${string}`;
  isBuy: boolean;
  tokenAmount: string;
  wethAmount: string;
  /** USD per token at the trade, at the quote asset's USD price when it was indexed. */
  priceUsd: number;
  /**
   * Quote asset (ETH or USDC) per token right after the trade: the spot price, so a buy always
   * raises it and a sell lowers it. Absent on trades indexed before it was recorded.
   */
  priceQuote?: number;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  timestamp: number;
}

/**
 * A trade's price on a chart: its quote price at today's quote USD price, so the chart follows
 * the buys and sells instead of the quote asset's USD moves between them, and ends at the live
 * price. Trades without a quote price keep their recorded USD price.
 */
export function chartPriceUsd(
  trade: Pick<TradeEventEntity, 'priceUsd' | 'priceQuote'>,
  quotePriceUsd: number | undefined,
): number {
  return trade.priceQuote && quotePriceUsd && quotePriceUsd > 0
    ? trade.priceQuote * quotePriceUsd
    : trade.priceUsd;
}

export interface CandlestickEntity {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TokenHolder {
  address: string;
  balance: string;
  percent: number;
}

export interface TokenCommentEntity {
  id: string;
  tokenAddress: string;
  authorAddress: string;
  content: string;
  imageUrl?: string;
  likesCount: number;
  repostsCount?: number;
  quotesCount?: number;
  repliesCount?: number;
  viewsCount?: number;
  parentId?: string;
  quotedCalloutId?: string;
  quotedCallout?: FeedCalloutItem;
  createdAt: number;
  isLikedByViewer?: boolean;
  isRepostedByViewer?: boolean;
  targetMcap?: string;
  positionUsd?: number;
  supplyPercent?: number;
  profitUsd?: number;
  /**
   * Token price (USD) at the moment the callout was submitted.
   * Used by the feed to display live unrealized PnL vs current price.
   * Stored once at write time; never mutated on read.
   */
  priceAtPost?: number;
  callType?: 'call' | 'comment';
}

export interface FeedCalloutItem extends TokenCommentEntity {
  tokenName?: string;
  tokenSymbol?: string;
  tokenLogo?: string;
  tokenMarketCapUsd?: number;
  tokenPriceUsd?: number;
  holdersCount?: number;
  replies?: FeedCalloutItem[];
}

export interface CommentSignaturePayload {
  tokenAddress: string;
  authorAddress: string;
  content: string;
  timestamp: number;
}

/**
 * Builds the canonical message string to be signed by the author's wallet
 * for on-chain identity authentication of comments and callouts.
 */
export function buildCommentSignMessage(params: CommentSignaturePayload): string {
  return [
    'Goton Community Signal',
    `Token: ${params.tokenAddress.toLowerCase()}`,
    `Author: ${params.authorAddress.toLowerCase()}`,
    `Timestamp: ${params.timestamp}`,
    `Content: ${params.content.trim()}`,
  ].join('\n');
}

/** Lifetime of a social session token issued by POST /api/auth/session. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Message a wallet signs once to open a social session (likes, reposts, sentiment votes).
 * `issuedAt` must be recent when exchanged for a session token.
 */
export function buildSessionSignMessage(params: { address: string; issuedAt: number }): string {
  return [
    'Goton Sign-In',
    `Wallet: ${params.address.toLowerCase()}`,
    `Issued: ${params.issuedAt}`,
    'Purpose: like, repost and vote as this wallet for 24 hours',
  ].join('\n');
}

/** An escrowed limit / take-profit / stop-loss order of GotonLimitOrders, as indexed by the API. */
export interface LimitOrderEntity {
  /** `${chainId}-${orderId}` */
  key: string;
  chainId: number;
  orderId: string;
  owner: `0x${string}`;
  token: `0x${string}`;
  isBuy: boolean;
  /** Buy: native quote deposited (wei). Sell: tokens deposited (raw units). */
  amount: string;
  /** Buy: minimum tokens. Sell: take-profit floor in quote raw units ('0' = none). */
  minOut: string;
  /** Sell stop-loss trigger, quote raw per token raw x 1e36 ('0' = none). */
  slPriceX36: string;
  slMinOut: string;
  /** Unix seconds. */
  deadline: number;
  status: 'open' | 'filled' | 'cancelled';
  /** Set when filled: 'buy' | 'takeProfit' | 'stopLoss'. */
  filledLeg?: 'buy' | 'takeProfit' | 'stopLoss';
  amountOut?: string;
  createdTx: string;
  closedTx?: string;
  createdAt: number;
  updatedAt: number;
}
