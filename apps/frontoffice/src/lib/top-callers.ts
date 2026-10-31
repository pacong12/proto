import { calculateUnrealizedPnl } from '@goton/math-sdk';
import type { FeedCalloutItem } from '@goton/shared-types';

export interface TopCaller {
  address: string;
  calls: number;
  /** Profit in USD across the caller's priced calls since each call. */
  profitUsd: number;
  /** The caller's best call, in percent since the call. */
  bestPct: number;
  bestSymbol?: string;
}

/**
 * Ranks callers by the profit of their calls since posting (entry price at the call, the token's
 * price now, the position they held). Replies are not calls; calls without an entry price or a
 * position count as calls but add no profit.
 */
export function rankCallers(callouts: readonly FeedCalloutItem[], limit = 8): TopCaller[] {
  const byAuthor = new Map<string, TopCaller>();
  for (const c of callouts) {
    if (c.parentId || c.callType === 'comment') continue;
    const key = c.authorAddress.toLowerCase();
    const row = byAuthor.get(key) ?? {
      address: c.authorAddress,
      calls: 0,
      profitUsd: 0,
      bestPct: -Infinity,
    };
    row.calls++;
    const entry = c.priceAtPost ?? 0;
    const now = c.tokenPriceUsd ?? 0;
    if (entry > 0 && now > 0) {
      const { pnlPct, pnlUsd } = calculateUnrealizedPnl(entry, now, c.positionUsd || undefined);
      if (pnlUsd !== null) row.profitUsd += pnlUsd;
      if (pnlPct > row.bestPct) {
        row.bestPct = pnlPct;
        row.bestSymbol = c.tokenSymbol;
      }
    }
    byAuthor.set(key, row);
  }
  return [...byAuthor.values()]
    .map((r) => ({ ...r, bestPct: Number.isFinite(r.bestPct) ? r.bestPct : 0 }))
    .sort((a, b) => b.profitUsd - a.profitUsd || b.bestPct - a.bestPct || b.calls - a.calls)
    .slice(0, limit);
}
