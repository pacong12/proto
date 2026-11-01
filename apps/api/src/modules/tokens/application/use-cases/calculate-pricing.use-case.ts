import type { CurveState, LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';
import {
  calculateCurveMarketData,
  calculateMarketData,
  type MarketDataParams,
} from '@goton/math-sdk';

export class CalculatePricingUseCase {
  /**
   * Compute live market data for a token (see calculateMarketData in @goton/math-sdk).
   *
   * The ethPriceUsd parameter is the quote asset's USD price:
   *  - Robinhood Chain (ETH quote): the live ETH/USD price
   *  - Arc Network (USDC quote): 1.0
   */
  execute(
    params: Omit<MarketDataParams, 'quotePriceUsd'> & { ethPriceUsd: number },
  ): TokenMarketData {
    const { ethPriceUsd, ...rest } = params;
    return calculateMarketData({ ...rest, quotePriceUsd: ethPriceUsd });
  }

  /** Market data of a token on its bonding curve, from the curve's live on-chain state. */
  fromCurve(token: LaunchedTokenEntity, curve: CurveState, quotePriceUsd: number): TokenMarketData {
    return calculateCurveMarketData({
      address: token.address,
      ...curve,
      totalSupply: BigInt(token.totalSupply || '1000000000000000000000000000'),
      quotePriceUsd,
    });
  }
}
