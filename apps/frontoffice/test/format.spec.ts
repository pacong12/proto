import { describe, expect, it, vi, afterEach } from 'vitest';
import { formatMarketCap, formatRelativeTime } from '../src/lib/utils';

describe('formatMarketCap', () => {
  it('shows a dash for an unknown market cap instead of an invented figure', () => {
    for (const unknown of [undefined, null, 0, -1, Number.NaN, 'abc']) {
      expect(formatMarketCap(unknown as never)).toBe('—');
    }
  });

  it('formats known values with a single dollar sign', () => {
    expect(formatMarketCap(4_200)).toBe('$4.20K');
    expect(formatMarketCap('1500000')).toBe('$1.50M');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a dash for an unknown timestamp instead of "20743d ago"', () => {
    expect(formatRelativeTime(0)).toBe('—');
    expect(formatRelativeTime(Number.NaN)).toBe('—');
  });

  it('accepts milliseconds and seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
    const twoHoursAgo = Date.now() - 2 * 3_600_000;
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    expect(formatRelativeTime(Math.floor(twoHoursAgo / 1000))).toBe('2h ago');
  });
});
