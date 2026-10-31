/** Ceiling for the indexer's back-off after failed polls (rate limits, outages). */
export const POLL_BACKOFF_MAX_MS = 60_000;

/**
 * Delay before an indexer's next poll. A failed poll (for example an RPC answering 429) doubles
 * the previous delay, from at least the active interval up to POLL_BACKOFF_MAX_MS, so a
 * rate-limited endpoint is not hammered; a successful poll goes back to the normal rhythm.
 */
export function nextPollDelay(p: {
  failed: boolean;
  previousMs: number;
  behind: boolean;
  found: number;
  interval: { active: number; idle: number };
  catchUpMs: number;
}): number {
  if (p.failed) return Math.min(Math.max(p.previousMs * 2, p.interval.active), POLL_BACKOFF_MAX_MS);
  if (p.behind) return p.catchUpMs;
  return p.found > 0 ? p.interval.active : p.interval.idle;
}
