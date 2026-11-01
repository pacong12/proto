import type { PositionPnl, TradeEventEntity } from '@goton/shared-types';

/**
 * Profit and loss of one wallet's trades in one token, by average cost: a sell realizes its
 * proceeds against the average cost of the tokens held at that moment, and what is still held is
 * valued at `priceUsd`. A sell of more than the trades bought (tokens received by transfer) only
 * costs what was held. `supplyTokens` turns prices into market caps.
 */
export function positionPnl(
  trades: readonly TradeEventEntity[],
  priceUsd: number,
  supplyTokens: number,
): PositionPnl {
  const chronological = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  let invested = 0;
  let proceeds = 0;
  let bought = 0;
  let sold = 0;
  let holding = 0;
  let cost = 0;
  let realized = 0;
  let buys = 0;
  let sells = 0;
  for (const t of chronological) {
    const amount = Math.max(0, parseFloat(t.tokenAmount || '0') || 0);
    const usd = amount * (t.priceUsd || 0);
    if (t.isBuy) {
      buys++;
      invested += usd;
      bought += amount;
      holding += amount;
      cost += usd;
    } else {
      sells++;
      proceeds += usd;
      sold += amount;
      const covered = Math.min(amount, holding);
      const soldCost = holding > 0 ? cost * (covered / holding) : 0;
      realized += usd - soldCost;
      cost -= soldCost;
      holding -= covered;
    }
  }
  const unrealized = holding * priceUsd - cost;
  const total = realized + unrealized;
  return {
    investedUsd: invested,
    proceedsUsd: proceeds,
    realizedUsd: realized,
    unrealizedUsd: unrealized,
    totalUsd: total,
    percent: invested > 0 ? (total / invested) * 100 : null,
    holdingTokens: holding,
    avgEntryMarketCapUsd: bought > 0 ? (invested / bought) * supplyTokens : null,
    avgExitMarketCapUsd: sold > 0 ? (proceeds / sold) * supplyTokens : null,
    marketCapUsd: priceUsd * supplyTokens,
    buys,
    sells,
    firstTradeAt: chronological[0]?.timestamp ?? null,
    lastTradeAt: chronological.at(-1)?.timestamp ?? null,
    // Dust left by rounding (a millionth of what was bought) does not count as a position.
    status: holding > bought * 1e-6 ? 'holding' : 'sold',
  };
}
