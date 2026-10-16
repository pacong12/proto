import type { TradeEventEntity } from '@goton/shared-types';
import type { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import { ValidationError } from '../../../../core/errors/app-error';

export class GetRecentTradesUseCase {
  constructor(private readonly tradeRepository: TradeRepositoryPort) {}

  async execute(trader?: string, limit = 30): Promise<TradeEventEntity[]> {
    const clampedLimit = Math.min(100, Math.max(1, limit));

    if (trader) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(trader)) {
        throw new ValidationError('trader must be a valid 20-byte hex address', 'INVALID_PARAM');
      }
      return this.tradeRepository.getTradesByTrader(trader, clampedLimit);
    }

    return this.tradeRepository.getRecentTrades(clampedLimit);
  }
}
