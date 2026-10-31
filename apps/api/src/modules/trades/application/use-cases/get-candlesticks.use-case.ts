import type { Address } from 'viem';
import { resolveTokenNetwork, type CandlestickEntity } from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../../tokens';
import type { PriceFeedPort } from '../../../tokens';
import { ValidationError, assertAddress } from '../../../../core/errors/app-error';

/** Candle widths the API serves, in seconds. */
export const VALID_RESOLUTIONS = [1, 60, 300, 900, 3600, 14400, 86400];

/**
 * A token's candles in USD, at its quote asset's USD price now (see chartPriceUsd): a buy always
 * draws up and a sell down, and the last candle meets the live price.
 */
export class GetCandlesticksUseCase {
  constructor(
    private readonly tokenRepository: TokenRepositoryPort,
    private readonly priceFeed: Pick<PriceFeedPort, 'getQuoteAssetPriceUsd'>,
  ) {}

  async execute(
    address: string,
    resolutionSeconds = 1,
    fillGaps = false,
  ): Promise<CandlestickEntity[]> {
    assertAddress(address);

    if (!VALID_RESOLUTIONS.includes(resolutionSeconds)) {
      throw new ValidationError(
        `Resolution must be one of: ${VALID_RESOLUTIONS.join(', ')} seconds`,
        'INVALID_RESOLUTION',
      );
    }

    const token = await this.tokenRepository.findByAddress(address as Address);
    // Without a quote price, trades keep the USD price they were indexed at.
    const quotePriceUsd = await this.priceFeed
      .getQuoteAssetPriceUsd(resolveTokenNetwork(token).chainId)
      .catch(() => undefined);
    return this.tokenRepository.getCandlesticks(
      address as Address,
      resolutionSeconds,
      fillGaps,
      quotePriceUsd,
    );
  }
}
