import { describe, it, expect } from 'vitest';
import { aggregateCandlesticks } from '../src/ohlcv-aggregator';

describe('Math SDK - OHLCV Aggregator', () => {
  it('returns empty array when trades is empty and fillGaps is false', () => {
    expect(aggregateCandlesticks([])).toEqual([]);
  });

  it('buckets trades by resolution time and calculates OHLCV correctly', () => {
    const baseTime = 1700000000000;
    const trades = [
      { timestamp: baseTime + 1000, priceUsd: 1.0, wethAmount: '0.5' },
      { timestamp: baseTime + 2000, priceUsd: 1.5, wethAmount: '1.0' },
      { timestamp: baseTime + 3000, priceUsd: 0.8, wethAmount: '0.2' },
      { timestamp: baseTime + 4000, priceUsd: 1.2, wethAmount: '0.3' },
    ];

    const candles = aggregateCandlesticks(trades, 60);
    expect(candles).toHaveLength(1);
    const c = candles[0];
    expect(c.open).toBe(1.0);
    expect(c.high).toBe(1.5);
    expect(c.low).toBe(0.8);
    expect(c.close).toBe(1.2);
    expect(c.volume).toBeCloseTo(2.0, 5);
  });

  it('guarantees zero ghost candles prior to token creation startTime', () => {
    const creationTime = 1700000060000; // Minute 1
    const tradeTime = 1700000120000; // Minute 2
    const nowTime = 1700000180000; // Minute 3

    const trades = [{ timestamp: tradeTime, priceUsd: 0.00001, wethAmount: '0.1' }];

    const candles = aggregateCandlesticks(trades, 60, {
      startTime: creationTime,
      endTime: nowTime,
      fillGaps: true,
      fallbackPrice: 0.00001,
    });

    // All candle timestamps must be >= creationTime
    for (const bar of candles) {
      expect(bar.timestamp).toBeGreaterThanOrEqual(Math.floor(creationTime / 60000) * 60000);
    }
  });

  it('supports 1-second resolution', () => {
    const now = 1700000000000;
    const trades = [
      { timestamp: now, priceUsd: 0.0000076, wethAmount: '0.1' },
      { timestamp: now + 1000, priceUsd: 0.0000079, wethAmount: '0.2' },
      { timestamp: now + 2000, priceUsd: 0.0000082, wethAmount: '0.3' },
    ];

    const candles = aggregateCandlesticks(trades, 1, {
      startTime: now,
      endTime: now + 2000,
      fillGaps: true,
      fallbackPrice: 0.0000076,
    });

    expect(candles.length).toBe(3);
    expect(candles[0].close).toBe(0.0000076);
    expect(candles[1].close).toBe(0.0000079);
    expect(candles[2].close).toBe(0.0000082);
  });
});
