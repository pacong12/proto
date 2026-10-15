import { describe, it, expect } from 'vitest';
import { calculateUnrealizedPnl, calculateRealizedPnl, calculateTraderTotalPnl } from '../src/pnl';

describe('Math SDK - PnL Derivations', () => {
  describe('calculateUnrealizedPnl', () => {
    it('returns zero for invalid prices', () => {
      expect(calculateUnrealizedPnl(0, 10)).toEqual({ pnlPct: 0, pnlUsd: null });
      expect(calculateUnrealizedPnl(10, 0)).toEqual({ pnlPct: 0, pnlUsd: null });
    });

    it('calculates unrealized profit % and dollar value correctly', () => {
      // Entry: $0.00001, Current: $0.00002 (+100%), Position: $200 -> PnL: +$200
      const res = calculateUnrealizedPnl(0.00001, 0.00002, 200);
      expect(res.pnlPct).toBeCloseTo(100, 4);
      expect(res.pnlUsd).toBeCloseTo(200, 4);
    });

    it('calculates unrealized loss % and dollar value correctly', () => {
      // Entry: $0.00002, Current: $0.00001 (-50%), Position: $200 -> PnL: -$100
      const res = calculateUnrealizedPnl(0.00002, 0.00001, 200);
      expect(res.pnlPct).toBeCloseTo(-50, 4);
      expect(res.pnlUsd).toBeCloseTo(-100, 4);
    });
  });

  describe('calculateRealizedPnl', () => {
    it('returns sell - buy when isCleanAll is true', () => {
      const res = calculateRealizedPnl({
        buyVolumeUsd: 1000,
        sellVolumeUsd: 1500,
        isCleanAll: true,
      });
      expect(res.usd).toBe(500);
      expect(res.pct).toBe(50);
    });

    it('calculates partial realized profit against cost basis of sold tokens', () => {
      // Bought $1000 worth (100 tokens @ $10/token)
      // Sold 40 tokens for $600 -> cost of sold = 40 * $10 = $400
      // Profit on sold = $600 - $400 = $200 -> +50%
      const res = calculateRealizedPnl({
        buyVolumeUsd: 1000,
        sellVolumeUsd: 600,
        remainingTokens: 60,
        avgCostUsd: 10,
        isCleanAll: false,
      });
      expect(res.usd).toBe(200);
      expect(res.pct).toBe(50);
    });
  });

  describe('calculateTraderTotalPnl', () => {
    it('combines sold volume and open position value', () => {
      // Bought $1000, Sold $400, Currently Holding $800 worth
      // Total value = 400 + 800 = 1200
      // Profit = 1200 - 1000 = +$200 (+20%)
      const res = calculateTraderTotalPnl(1000, 400, 800);
      expect(res.usd).toBe(200);
      expect(res.pct).toBe(20);
    });
  });
});
