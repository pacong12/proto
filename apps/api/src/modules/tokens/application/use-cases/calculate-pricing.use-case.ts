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

  /**
   * Market data of a token from its bonding curve's live on-chain state. Once it graduated the
   * curve stays frozen at the graduation price while trading moves to its v4 pool: `poolSpot`, the
   * spot price in the quote asset after the newest trade, prices it then. Raised and target stay
   * the curve's.
   */
  fromCurve(
    token: LaunchedTokenEntity,
    curve: CurveState,
    quotePriceUsd: number,
    poolSpot?: number,
  ): TokenMarketData {
    const totalSupply = BigInt(token.totalSupply || '1000000000000000000000000000');
    if (curve.graduated && poolSpot && poolSpot > 0) {
      return calculateMarketData({
        address: token.address,
        spotPriceNative: poolSpot,
        pairedPrincipalWei: curve.totalEthRaised,
        thresholdWei: curve.graduationTarget,
        totalSupply,
        quotePriceUsd,
      });
    }
    return calculateCurveMarketData({
      address: token.address,
      ...curve,
      totalSupply,
      quotePriceUsd,
    });
  }
}
