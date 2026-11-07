import { calculateUnrealizedPnl } from '@goton/math-sdk';
import type { FeedCalloutItem } from '@goton/shared-types';

type PricedCall = Pick<FeedCalloutItem, 'priceAtPost' | 'tokenPriceUsd' | 'positionUsd'>;

/** A call's result since it was posted, from the server's prices; null without both prices. */
export function callPnl(call: PricedCall): { pct: number; usd: number | null } | null {
  const entry = call.priceAtPost ?? 0;
  const now = call.tokenPriceUsd ?? 0;
  if (entry <= 0 || now <= 0) return null;
  const { pnlPct, pnlUsd } = calculateUnrealizedPnl(entry, now, call.positionUsd || undefined);
  return { pct: pnlPct, usd: pnlUsd };
}

/** The token trades above the price at the call. */
export function isCallInProfit(call: PricedCall): boolean {
  return (callPnl(call)?.pct ?? 0) > 0;
}
