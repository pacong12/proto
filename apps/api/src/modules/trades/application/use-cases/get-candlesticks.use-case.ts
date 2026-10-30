import type { Address } from 'viem';
import type { CandlestickEntity } from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../../tokens/domain/ports/token.repository.port';
import { ValidationError } from '../../../../core/errors/app-error';

/** Candle widths the API serves, in seconds. */
export const VALID_RESOLUTIONS = [1, 60, 300, 900, 3600, 14400, 86400];

export class GetCandlesticksUseCase {
  constructor(private readonly tokenRepository: TokenRepositoryPort) {}

  async execute(
    address: string,
    resolutionSeconds = 1,
    fillGaps = false,
  ): Promise<CandlestickEntity[]> {
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

    return this.tokenRepository.getCandlesticks(address as Address, resolutionSeconds, fillGaps);
  }
}
