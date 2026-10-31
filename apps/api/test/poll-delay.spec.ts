import { describe, expect, it } from 'vitest';
import { nextPollDelay, POLL_BACKOFF_MAX_MS } from '../src/app/poll-delay';

const base = { interval: { active: 3_000, idle: 10_000 }, catchUpMs: 250, behind: false, found: 0 };

describe('nextPollDelay', () => {
  it('keeps the normal rhythm after a successful poll', () => {
    expect(nextPollDelay({ ...base, failed: false, previousMs: 250, found: 2 })).toBe(3_000);
    expect(nextPollDelay({ ...base, failed: false, previousMs: 3_000 })).toBe(10_000);
    expect(nextPollDelay({ ...base, failed: false, previousMs: 10_000, behind: true })).toBe(250);
  });

  it('backs off after failures instead of retrying at the catch-up pace', () => {
    let delay = 250; // failing while catching up used to retry every 250ms
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      delay = nextPollDelay({ ...base, failed: true, previousMs: delay });
      seen.push(delay);
    }
    expect(seen).toEqual([
      3_000,
      6_000,
      12_000,
      24_000,
      48_000,
      POLL_BACKOFF_MAX_MS,
      POLL_BACKOFF_MAX_MS,
    ]);
  });

  it('returns to normal as soon as a poll succeeds', () => {
    expect(
      nextPollDelay({ ...base, failed: false, previousMs: POLL_BACKOFF_MAX_MS, found: 1 }),
    ).toBe(3_000);
  });
});
