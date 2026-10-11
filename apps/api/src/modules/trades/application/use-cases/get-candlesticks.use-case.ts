import type { Address } from 'viem';
import { aggregateCandlesticks, type CandlestickBar } from '@proto/math-sdk';
import type { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import type { TokenRepositoryPort } from '../../../tokens/domain/ports/token.repository.port';
import { ValidationError } from '../../../../core/errors/app-error';

export const VALID_RESOLUTIONS = [1, 60, 300, 900, 3600, 14400, 86400];

export class GetCandlesticksUseCase {
  constructor(
    private readonly tradeRepository: TradeRepositoryPort,
    private readonly tokenRepository: TokenRepositoryPort,
  ) {}

  async execute(
    address: string,
    resolutionSeconds = 1,
    fillGaps = false,
  ): Promise<CandlestickBar[]> {
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new ValidationError(
        'Token address must be a valid 42-character hex string',
        'INVALID_ADDRESS',
      );
    }

    if (!VALID_RESOLUTIONS.includes(resolutionSeconds)) {
      throw new ValidationError(
        `Resolution must be one of: ${VALID_RESOLUTIONS.join(', ')} seconds`,
        'INVALID_RESOLUTION',
      );
    }

    const token = await this.tokenRepository.findByAddress(address as Address);
    const mkt = await this.tokenRepository.getMarketData(address as Address);
    const trades = await this.tradeRepository.getTrades(address as Address, 1000, 0);

    // Convert trades to chronological order for candlestick aggregation
    const chronologicalTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    return aggregateCandlesticks(chronologicalTrades, resolutionSeconds, {
      startTime: token?.createdAt,
      endTime: Date.now(),
      fillGaps,
      maxCandles: 1000,
      fallbackPrice: mkt?.priceUsd || 0.0000042,
    });
  }
}
