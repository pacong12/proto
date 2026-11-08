import { describe, expect, it } from 'vitest';
import { resolutionForAge } from '../src/lib/chart-interval';

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
