import type { ApiEnvelope, TradeEventEntity } from '@proto/shared-types';
import { ok, err } from '@proto/shared-types';
import type { TopTraderItem } from '../domain/entities/trade.entity';
import type { CandlestickBar } from '@proto/math-sdk';
import { GetTradesUseCase } from '../application/use-cases/get-trades.use-case';
import { GetRecentTradesUseCase } from '../application/use-cases/get-recent-trades.use-case';
import { GetTopTradersUseCase } from '../application/use-cases/get-top-traders.use-case';
import { GetCandlesticksUseCase } from '../application/use-cases/get-candlesticks.use-case';
import { AppError } from '../../../core/errors/app-error';

export class TradeController {
  constructor(
    private readonly getTradesUseCase: GetTradesUseCase,
    private readonly getRecentTradesUseCase: GetRecentTradesUseCase,
    private readonly getTopTradersUseCase: GetTopTradersUseCase,
    private readonly getCandlesticksUseCase: GetCandlesticksUseCase,
  ) {}

  async getTrades(
    address: string,
    limit = 50,
    offset = 0,
  ): Promise<ApiEnvelope<TradeEventEntity[]>> {
    try {
      const data = await this.getTradesUseCase.execute(address, limit, offset);
      return ok(data);
    } catch (e) {
      if (e instanceof AppError) {
        return err(e.code, e.message);
      }
      return err('FETCH_TRADES_FAILED', (e as Error).message);
    }
  }

  async getRecentTrades(trader?: string, limit = 30): Promise<ApiEnvelope<TradeEventEntity[]>> {
    try {
      const data = await this.getRecentTradesUseCase.execute(trader, limit);
      return ok(data);
    } catch (e) {
      if (e instanceof AppError) {
        return err(e.code, e.message);
      }
      return err('FETCH_RECENT_TRADES_FAILED', (e as Error).message);
    }
  }

  async getTopTraders(address: string, limit = 20): Promise<ApiEnvelope<TopTraderItem[]>> {
    try {
      const data = await this.getTopTradersUseCase.execute(address, limit);
      return ok(data);
    } catch (e) {
      if (e instanceof AppError) {
        return err(e.code, e.message);
      }
      return err('FETCH_TOP_TRADERS_FAILED', (e as Error).message);
    }
  }

  async getCandlesticks(
    address: string,
    resolutionSeconds = 1,
    fillGaps = false,
  ): Promise<ApiEnvelope<CandlestickBar[]>> {
    try {
      const data = await this.getCandlesticksUseCase.execute(address, resolutionSeconds, fillGaps);
      return ok(data);
    } catch (e) {
      if (e instanceof AppError) {
        return err(e.code, e.message);
      }
      return err('FETCH_CANDLESTICKS_FAILED', (e as Error).message);
    }
  }
}
