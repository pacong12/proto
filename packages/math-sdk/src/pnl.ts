export interface PnlSummary {
  usd: number;
  pct: number;
}

/**
 * Calculates unrealized PnL percentage and optional dollar value for a position.
 * formula pct: ((currentPrice - entryPrice) / entryPrice) * 100
 * formula usd: positionUsd * (currentPrice / entryPrice - 1)
 */
export function calculateUnrealizedPnl(
  entryPrice: number,
  currentPrice: number,
  positionUsd?: number,
): { pnlPct: number; pnlUsd: number | null } {
  if (entryPrice <= 0 || currentPrice <= 0) {
    return { pnlPct: 0, pnlUsd: null };
  }

  const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;

  if (positionUsd === undefined || positionUsd <= 0) {
    return { pnlPct, pnlUsd: null };
  }

  const pnlUsd = positionUsd * (currentPrice / entryPrice - 1);
  return { pnlPct, pnlUsd };
}

/**
 * Calculates realized PnL from historical trading volumes and cost basis.
 */
export function calculateRealizedPnl(params: {
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  remainingTokens?: number;
  avgCostUsd?: number;
  isCleanAll?: boolean;
}): PnlSummary {
  const buy = params.buyVolumeUsd || 0;
  const sell = params.sellVolumeUsd || 0;

  if (params.isCleanAll) {
    const usd = Math.round(sell - buy);
    const pct = buy > 0 ? (usd / buy) * 100 : 0;
    return { usd, pct };
  }

  if (sell > 0) {
    const holdingCost = (params.remainingTokens || 0) * (params.avgCostUsd || 0);
    const costOfSold = Math.max(0, buy - holdingCost);
    const usd = Math.round(sell - costOfSold);
    const pct = costOfSold > 0 ? (usd / costOfSold) * 100 : 0;
    return { usd, pct };
  }

  return { usd: 0, pct: 0 };
}

/**
 * Calculates total PnL combining realized proceeds and current open holding value.
 * formula: (sellVolume + currentHoldingUsd) - buyVolume
 */
export function calculateTraderTotalPnl(
  buyVolumeUsd: number,
  sellVolumeUsd: number,
  currentHoldingUsd: number,
): PnlSummary {
  const buy = buyVolumeUsd || 0;
  const sell = sellVolumeUsd || 0;
  const totalValue = sell + currentHoldingUsd;
  const usd = Math.round(totalValue - buy);
  const pct = buy > 0 ? (usd / buy) * 100 : 0;
  return { usd, pct };
}
