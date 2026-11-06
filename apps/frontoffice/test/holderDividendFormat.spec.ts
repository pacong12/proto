import { describe, expect, it } from 'vitest';
import { formatDividendAmount } from '../src/composables/useHolderDividends';

describe('formatDividendAmount', () => {
  it('keeps a tiny balance visible and readable by Number()', () => {
    const shown = formatDividendAmount(23n, 6);
    expect(shown).toBe('0.000023');
    expect(Number(shown)).toBeGreaterThan(0);
  });

  it('writes the smallest 18-decimal unit without an exponent', () => {
    expect(formatDividendAmount(1n, 18)).toBe('0.000000000000000001');
  });

  it('uses four decimals from 0.0001 up, with no grouping', () => {
    expect(formatDividendAmount(100n, 6)).toBe('0.0001');
    expect(formatDividendAmount(1_234_567_890n, 6)).toBe('1234.5679');
  });

  it('shows nothing owed as 0.0000', () => {
    expect(formatDividendAmount(0n, 18)).toBe('0.0000');
  });
});
