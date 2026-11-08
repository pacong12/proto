import { describe, expect, it } from 'vitest';
import { chainCandles, isTradedBar, resolutionForAge } from '../src/lib/chart-interval';

const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const ago = (seconds: number) => NOW - seconds * 1000;

describe('resolutionForAge', () => {
  it('opens a young coin on minutes and an old one on hours or days', () => {
    expect(resolutionForAge(ago(30 * 60), NOW)).toBe(60);
    expect(resolutionForAge(ago(6 * 3600), NOW)).toBe(300);
    expect(resolutionForAge(ago(24 * 3600), NOW)).toBe(900);
    expect(resolutionForAge(ago(3 * 86400), NOW)).toBe(3600);
    expect(resolutionForAge(ago(20 * 86400), NOW)).toBe(14400);
    expect(resolutionForAge(ago(90 * 86400), NOW)).toBe(86400);
  });

  it('never picks 1s, so a chart always has history', () => {
    expect(resolutionForAge(ago(5), NOW)).toBe(60);
  });

  it('accepts seconds as well as milliseconds, and falls back to 1h when unknown', () => {
    expect(resolutionForAge(Math.floor(ago(3 * 86400) / 1000), NOW)).toBe(3600);
    expect(resolutionForAge(0, NOW)).toBe(3600);
    expect(resolutionForAge(Number.NaN, NOW)).toBe(3600);
  });
});

describe('isTradedBar', () => {
  const flat = { open: 1, high: 1, low: 1, close: 1, volume: 0 };
  it('drops empty filler bars and keeps traded or moving ones', () => {
    expect(isTradedBar(flat)).toBe(false);
    expect(isTradedBar({ ...flat, volume: 0.5 })).toBe(true);
    expect(isTradedBar({ ...flat, close: 1.1, high: 1.1 })).toBe(true);
    expect(isTradedBar({ open: 1, high: 1, low: 1, close: 1 })).toBe(false);
  });
});

describe('chainCandles', () => {
  it('opens each candle at the previous close and widens its range to include it', () => {
    const bars = chainCandles([
      { open: 1, high: 2, low: 1, close: 2 },
      { open: 3, high: 3, low: 3, close: 3 },
      { open: 2.5, high: 2.5, low: 2.5, close: 2.5 },
    ]);
    expect(bars[0]).toEqual({ open: 1, high: 2, low: 1, close: 2 });
    expect(bars[1]).toEqual({ open: 2, high: 3, low: 2, close: 3 });
    expect(bars[2]).toEqual({ open: 3, high: 3, low: 2.5, close: 2.5 });
  });
});
