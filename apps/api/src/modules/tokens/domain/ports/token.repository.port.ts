import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
  TokenCommentEntity,
  type CreatorProfile,
} from '@proto/shared-types';

export interface TokenRepositoryPort {
  save(token: LaunchedTokenEntity): Promise<void>;
  findByAddress(address: `0x${string}`): Promise<LaunchedTokenEntity | null>;
  findAll(
    limit?: number,
    offset?: number,
    filters?: { version?: 'v1' | 'v2'; deployer?: string },
  ): Promise<LaunchedTokenEntity[]>;
  /** Look up a single token by its Uniswap pool address. Avoids full-table JS scans. */
  findByPoolAddress?(poolAddress: `0x${string}`): Promise<LaunchedTokenEntity | null>;
  /** Aggregate total volume across all tokens for the given time window. */
  getVolumeByToken?(sinceMs: number): Promise<Array<{ tokenAddress: string; totalWeth: number }>>;
  saveMarketData(marketData: TokenMarketData): Promise<void>;
  getMarketData(address: `0x${string}`): Promise<TokenMarketData | null>;
  saveTrade(trade: TradeEventEntity): Promise<void>;
  getTrades(
    tokenAddress: `0x${string}`,
    limit?: number,
    offset?: number,
  ): Promise<TradeEventEntity[]>;
  getCandlesticks(
    tokenAddress: `0x${string}`,
    resolutionSeconds?: number,
    fillGaps?: boolean,
  ): Promise<CandlestickEntity[]>;
  getHolders(
    tokenAddress: string,
    limit?: number,
  ): Promise<Array<{ address: string; balance: string; percent: number }>>;
  getRecentTrades?(limit?: number): Promise<TradeEventEntity[]>;
  getTradesByTrader?(trader: string, limit?: number): Promise<TradeEventEntity[]>;
  getTradesSince?(sinceMs: number): Promise<TradeEventEntity[]>;
  /** Trades with fromBlock <= block <= toBlock (toBlock 0 = no upper bound), oldest first. */
  getTradesInBlockRange?(
    fromBlock: bigint,
    toBlock: bigint,
    limit: number,
  ): Promise<TradeEventEntity[]>;
  findTradeByHash?(txHash: string): Promise<TradeEventEntity | null>;
  findAddressByIdentity?(nameOrSlug: string): Promise<string | null>;
  getUserPositions?(address: string): Promise<
    Array<{
      tokenAddress: string;
      name: string;
      symbol: string;
      logo?: string;
      balance: number;
      balanceFormatted: string;
      priceUsd: number;
      valueUsd: number;
    }>
  >;

  // Discussion comments & sentiment voting
  saveComment?(comment: TokenCommentEntity): Promise<void>;
  getComments?(tokenAddress: string, viewerAddress?: string): Promise<TokenCommentEntity[]>;
  getFeedCallouts?(
    limit?: number,
    offset?: number,
    viewerAddress?: string,
    authorAddress?: string,
  ): Promise<import('@proto/shared-types').FeedCalloutItem[]>;
  getCalloutThread?(
    calloutId: string,
    viewerAddress?: string,
  ): Promise<import('@proto/shared-types').FeedCalloutItem | null>;
  toggleCommentLike?(
    commentId: string,
    userAddress: string,
  ): Promise<{ liked: boolean; likesCount: number }>;
  toggleCommentRepost?(
    commentId: string,
    userAddress: string,
  ): Promise<{ reposted: boolean; repostsCount: number }>;
  incrementCommentViews?(commentId: string): Promise<number>;

  // Indexer persistence
  getLastIndexedBlock?(networkName: string): Promise<bigint | null>;
  setLastIndexedBlock?(networkName: string, blockNumber: bigint): Promise<void>;

  // Sentiment voting
  getProfile?(address: string): Promise<CreatorProfile | null>;
  saveProfile?(address: string, profile: CreatorProfile): Promise<void>;
  /** GRC-04: erase off-chain social data tied to a wallet. */
  deleteUserData?(address: string): Promise<{
    comments: number;
    likes: number;
    reposts: number;
    sentiment: number;
    profile: number;
  }>;
  getTokenSentiment?(
    tokenAddress: string,
    userAddress?: string,
  ): Promise<{
    bullVotes: number;
    bearVotes: number;
    totalVotes: number;
    bullPercent: number;
    bearPercent: number;
    userVote?: 'bull' | 'bear';
  }>;
  voteTokenSentiment?(
    tokenAddress: string,
    userAddress: string,
    sentiment: 'bull' | 'bear',
  ): Promise<{
    bullVotes: number;
    bearVotes: number;
    totalVotes: number;
    bullPercent: number;
    bearPercent: number;
    userVote: 'bull' | 'bear';
  }>;

  // Buyback and Burn tracking
  recordBuybackBurn?(burn: {
    tokenAddress: string;
    network: string;
    wethSpent: string;
    tokensBurned: string;
    transactionHash: string;
    timestamp: number;
  }): Promise<void>;
  getBuybackStats?(tokenAddress?: string): Promise<{
    totalBurns: number;
    totalTokensBurned: string;
    recentBurns: Array<{
      id: string;
      tokenAddress: string;
      network: string;
      wethSpent: string;
      tokensBurned: string;
      transactionHash: string;
      timestamp: number;
    }>;
  }>;
}
