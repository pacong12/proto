import { describe, expect, it } from 'vitest';
import { sparklineSince } from '../src/modules/tokens/application/sparkline';

const candle = (open: number, close: number) => ({ open, close });

describe('sparklineSince', () => {
  it('starts at the launch price and ends at the latest close', () => {
    const candles = [candle(1, 2), candle(2, 3), candle(3, 2.5), candle(2.5, 4)];
    expect(sparklineSince(candles, 40)).toEqual([1, 2, 3, 2.5, 4]);
  });

  it('samples a long history down to the point budget', () => {
    const candles = Array.from({ length: 1000 }, (_, i) => candle(i, i + 1));
    const line = sparklineSince(candles, 40);
    expect(line).toHaveLength(40);
    expect(line[0]).toBe(0); // launch open
    expect(line[39]).toBe(1000); // latest close
  });

  it('is empty without trades', () => {
    expect(sparklineSince([], 40)).toEqual([]);
  });
});
