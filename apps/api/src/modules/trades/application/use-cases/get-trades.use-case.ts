import type { Address } from 'viem';
import type { TradeEventEntity } from '@goton/shared-types';
import type { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import { assertAddress } from '../../../../core/errors/app-error';

export class GetTradesUseCase {
  constructor(private readonly tradeRepository: TradeRepositoryPort) {}

  async execute(address: string, limit = 50, offset = 0): Promise<TradeEventEntity[]> {
    assertAddress(address);

    const clampedLimit = Math.min(200, Math.max(1, limit));
    const clampedOffset = Math.max(0, offset);

    return this.tradeRepository.getTrades(address as Address, clampedLimit, clampedOffset);
  }
}
