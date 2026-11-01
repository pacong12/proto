import type { ApiEnvelope, TradeEventEntity } from '@goton/shared-types';
import type { TopTraderItem } from '../domain/entities/trade.entity';
import type { CandlestickBar } from '@goton/math-sdk';
import { GetTradesUseCase } from '../application/use-cases/get-trades.use-case';
import { GetRecentTradesUseCase } from '../application/use-cases/get-recent-trades.use-case';
import { GetTopTradersUseCase } from '../application/use-cases/get-top-traders.use-case';
import { GetCandlesticksUseCase } from '../application/use-cases/get-candlesticks.use-case';
import { toEnvelope } from '../../../core/http/api-envelope';

export class TradeController {
  constructor(
    private readonly getTradesUseCase: GetTradesUseCase,
    private readonly getRecentTradesUseCase: GetRecentTradesUseCase,
    private readonly getTopTradersUseCase: GetTopTradersUseCase,
    private readonly getCandlesticksUseCase: GetCandlesticksUseCase,
  ) {}

  getTrades(address: string, limit = 50, offset = 0): Promise<ApiEnvelope<TradeEventEntity[]>> {
    return toEnvelope('FETCH_TRADES_FAILED', () =>
      this.getTradesUseCase.execute(address, limit, offset),
    );
  }

  getRecentTrades(trader?: string, limit = 30): Promise<ApiEnvelope<TradeEventEntity[]>> {
    return toEnvelope('FETCH_RECENT_TRADES_FAILED', () =>
      this.getRecentTradesUseCase.execute(trader, limit),
    );
  }

  getTopTraders(address: string, limit = 20): Promise<ApiEnvelope<TopTraderItem[]>> {
    return toEnvelope('FETCH_TOP_TRADERS_FAILED', () =>
      this.getTopTradersUseCase.execute(address, limit),
    );
  }

  getCandlesticks(
    address: string,
    resolutionSeconds = 1,
    fillGaps = false,
  ): Promise<ApiEnvelope<CandlestickBar[]>> {
    return toEnvelope('FETCH_CANDLESTICKS_FAILED', () =>
      this.getCandlesticksUseCase.execute(address, resolutionSeconds, fillGaps),
    );
  }
}
