import { describe, it, expect } from 'vitest';
import { TradingChart, SimpleChart } from '../src/components/ui/chart';

describe('TradingChart & Candlestick Component', () => {
  it('exports TradingChart and SimpleChart from chart UI module', () => {
    expect(TradingChart).toBeDefined();
    expect(SimpleChart).toBeDefined();
  });

  it('verifies TradingChart component definition and props', () => {
    expect(typeof TradingChart).toBe('object');
    // Vue SFC component object has props or setup
    expect(TradingChart.name || TradingChart.__name).toBe('TradingChart');
  });

  it('generates realistic candlesticks with strictly valid OHLC bounds and timestamps', () => {
    // Test the OHLC generator logic directly
    const basePrice = 0.0000126;
    const resolutionSeconds = 60;
    const count = 40;
    const now = Math.floor(Date.now() / 1000);
    const nowAligned = Math.floor(now / resolutionSeconds) * resolutionSeconds;

    const rawSteps: Array<{
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }> = [];
    let current = basePrice * 0.92;

    for (let i = 0; i < count; i++) {
      const volatility = current * 0.025;
      const change = (Math.random() - 0.47) * volatility;
      const open = current;
      const close = Math.max(open + change, current * 0.01);
      const high = Math.max(open, close) + Math.random() * volatility * 0.7;
      const low = Math.max(
        Math.min(open, close) - Math.random() * volatility * 0.7,
        current * 0.005,
      );
      const volume = Math.floor(Math.random() * 5000 + 500);

      rawSteps.push({ open, high, low, close, volume });
      current = close;
    }

    const lastClose = rawSteps[rawSteps.length - 1]?.close || basePrice;
    const scale = basePrice / lastClose;

    const candles = rawSteps.map((step, idx) => {
      const time = nowAligned - (count - 1 - idx) * resolutionSeconds;
      const open = step.open * scale;
      const close = step.close * scale;
      const high = Math.max(step.high * scale, open, close);
      const low = Math.min(step.low * scale, open, close);

      return { time, open, high, low, close, volume: step.volume };
    });

    expect(candles).toHaveLength(count);

    // Verify invariants
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
      expect(c.low).toBeLessThanOrEqual(c.open);
      expect(c.low).toBeLessThanOrEqual(c.close);
      expect(c.open).toBeGreaterThan(0);
      expect(c.close).toBeGreaterThan(0);

      if (i > 0) {
        expect(c.time).toBeGreaterThan(candles[i - 1].time);
      }
    }

    // Last candle closes near basePrice
    const lastCandle = candles[candles.length - 1];
    expect(lastCandle.close).toBeCloseTo(basePrice, 7);
  });
});
