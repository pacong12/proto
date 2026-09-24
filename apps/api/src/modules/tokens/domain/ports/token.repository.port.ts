import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
  TokenCommentEntity,
  TokenVotesSummary,
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
  findTradeByHash?(txHash: string): Promise<TradeEventEntity | null>;

  // Discussion comments & sentiment voting
  saveComment?(comment: TokenCommentEntity): Promise<void>;
  getComments?(tokenAddress: string, viewerAddress?: string): Promise<TokenCommentEntity[]>;
  toggleCommentLike?(
    commentId: string,
    userAddress: string,
  ): Promise<{ liked: boolean; likesCount: number }>;
  saveVote?(
    tokenAddress: string,
    userAddress: string,
    voteType: 'bullish' | 'bearish',
  ): Promise<void>;
  getVotes?(tokenAddress: string, viewerAddress?: string): Promise<TokenVotesSummary>;
}
