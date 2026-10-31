import { TradeEventEntity, CandlestickEntity } from '@goton/shared-types';

export interface TradeFlow {
  buyQuote: number;
  sellQuote: number;
  buys: number;
  sells: number;
  buyers: number;
  sellers: number;
}

/** Indexed trades and what is derived from them (candles, flow, holders, positions). */
export interface TradeStorePort {
  /** Aggregate total volume across all tokens for the given time window. */
  getVolumeByToken?(sinceMs: number): Promise<Array<{ tokenAddress: string; totalWeth: number }>>;
  /** Buy vs sell activity since `sinceMs`: quote volume, trade counts and distinct traders. */
  getTradeFlow?(tokenAddress: `0x${string}`, sinceMs: number): Promise<TradeFlow>;
  /**
   * The newest trade at or before `cutoffMs`, or the token's first trade if it is younger: the
   * reference price for a 24h change, found without loading the trades in between.
   */
  getPriceAnchor?(tokenAddress: `0x${string}`, cutoffMs: number): Promise<TradeEventEntity | null>;
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
  /** A wallet's trades, newest first; of one token only when `tokenAddress` is given. */
  getTradesByTrader?(
    trader: string,
    limit?: number,
    tokenAddress?: string,
  ): Promise<TradeEventEntity[]>;
  getTradesSince?(sinceMs: number): Promise<TradeEventEntity[]>;
  /**
   * Trades with fromBlock <= block <= toBlock (toBlock 0 = no upper bound), oldest first,
   * optionally of one token.
   */
  getTradesInBlockRange?(
    fromBlock: bigint,
    toBlock: bigint,
    limit: number,
    tokenAddress?: `0x${string}`,
  ): Promise<TradeEventEntity[]>;
  findTradeByHash?(txHash: string): Promise<TradeEventEntity | null>;
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
}
