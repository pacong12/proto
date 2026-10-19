/** Sparkline data for token lists. */

export const SPARKLINE_POINTS = 40;

/**
 * A token's price path from launch to now in at most `points` values: the first candle's open
 * (launch price), then evenly spaced closes ending with the latest one. Trade prices only, so a
 * quiet token stays level instead of tracking the quote asset's USD drift.
 */
export function sparklineSince(
  candles: Array<{ open: number; close: number }>,
  points: number,
): number[] {
  if (candles.length === 0) return [];
  const closes = candles.map((c) => c.close);
  const out = [candles[0].open];
  const n = Math.min(points - 1, closes.length);
  // n indexes spread evenly from the first close to the last one.
  for (let i = 0; i < n; i++) {
    out.push(closes[n === 1 ? closes.length - 1 : Math.round((i / (n - 1)) * (closes.length - 1))]);
  }
  return out;
}
