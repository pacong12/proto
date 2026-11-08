const MIN = 60;
const HOUR = 3600;
const DAY = 86400;

/**
 * Candle interval that shows a coin's whole history in roughly 100-180 candles: a coin listed an
 * hour ago opens on 1m, a month-old one on 4h. A fixed 1s default showed a few flat seconds and
 * no history at all.
 *
 * @param createdAt launch time, in seconds or milliseconds
 * @param now current time in milliseconds
 */
export function resolutionForAge(createdAt: number, now = Date.now()): number {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return HOUR;
  const ms = createdAt < 1e12 ? createdAt * 1000 : createdAt;
  const age = Math.max(0, (now - ms) / 1000);
  if (age <= 2 * HOUR) return MIN;
  if (age <= 12 * HOUR) return 5 * MIN;
  if (age <= 36 * HOUR) return 15 * MIN;
  if (age <= 7 * DAY) return HOUR;
  if (age <= 30 * DAY) return 4 * HOUR;
  return DAY;
}

/**
 * A candle that holds a trade or a price move. The API pads quiet periods with flat, empty bars;
 * drawing them squeezed the real candles into slivers next to hours of flat line.
 */
export function isTradedBar(bar: {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}): boolean {
  return (bar.volume ?? 0) > 0 || bar.open !== bar.close || bar.high !== bar.low;
}

/**
 * Opens each candle at the previous candle's close, as trading charts do. The API opens a bucket
 * at its first trade, so a one-trade candle had no body (a dash) and every candle floated apart
 * from the one before it. Mutates and returns `bars`.
 */
export function chainCandles<T extends { open: number; high: number; low: number; close: number }>(
  bars: T[],
): T[] {
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i]!;
    const open = bars[i - 1]!.close;
    bar.open = open;
    bar.high = Math.max(bar.high, open);
    bar.low = Math.min(bar.low, open);
  }
  return bars;
}
