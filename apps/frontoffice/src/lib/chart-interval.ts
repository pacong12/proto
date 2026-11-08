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
