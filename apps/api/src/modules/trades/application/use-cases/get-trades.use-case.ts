import type { Address } from 'viem';
import type { TradeEventEntity } from '@goton/shared-types';
import type { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import { ValidationError } from '../../../../core/errors/app-error';

export class GetTradesUseCase {
  constructor(private readonly tradeRepository: TradeRepositoryPort) {}

  async execute(address: string, limit = 50, offset = 0): Promise<TradeEventEntity[]> {
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new ValidationError(
        'Token address must be a valid 42-character hex string',
        'INVALID_ADDRESS',
      );
    }

    const clampedLimit = Math.min(200, Math.max(1, limit));
    const clampedOffset = Math.max(0, offset);

    return this.tradeRepository.getTrades(address as Address, clampedLimit, clampedOffset);
  }
}
