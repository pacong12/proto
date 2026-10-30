import type { TradeStorePort } from '../../../tokens/domain/ports/trade-store.port';

/** The trade reads and writes the trades module needs; every store must provide them. */
export type TradeRepositoryPort = Required<
  Pick<
    TradeStorePort,
    'saveTrade' | 'getTrades' | 'getRecentTrades' | 'getTradesByTrader' | 'findTradeByHash'
  >
>;
