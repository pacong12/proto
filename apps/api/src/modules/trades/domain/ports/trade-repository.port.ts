import type { TradeStorePort } from '../../../tokens';

/** The trade reads and writes the trades module needs; every store must provide them. */
export type TradeRepositoryPort = Required<
  Pick<
    TradeStorePort,
    'saveTrade' | 'getTrades' | 'getRecentTrades' | 'getTradesByTrader' | 'findTradeByHash'
  >
>;
