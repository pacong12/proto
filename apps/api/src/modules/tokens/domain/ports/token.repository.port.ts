import {
  LaunchedTokenEntity,
  TokenMarketData,
  TradeEventEntity,
  CandlestickEntity,
} from '@proto/shared-types';

export interface TokenRepositoryPort {
  save(token: LaunchedTokenEntity): Promise<void>;
  findByAddress(address: `0x${string}`): Promise<LaunchedTokenEntity | null>;
  findAll(limit?: number, offset?: number): Promise<LaunchedTokenEntity[]>;
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
  ): Promise<CandlestickEntity[]>;
  getHolders(
    tokenAddress: string,
    limit?: number,
  ): Promise<Array<{ address: string; balance: string; percent: number }>>;
}
