import type { Address } from 'viem';
import type { TradeEventEntity } from '@proto/shared-types';

export interface TradeRepositoryPort {
  saveTrade(trade: TradeEventEntity): Promise<void>;
  getTrades(tokenAddress: Address, limit?: number, offset?: number): Promise<TradeEventEntity[]>;
  getRecentTrades(limit?: number): Promise<TradeEventEntity[]>;
  getTradesByTrader(trader: string, limit?: number): Promise<TradeEventEntity[]>;
  findTradeByHash(txHash: string): Promise<TradeEventEntity | null>;
}
