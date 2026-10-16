import { describe, it, expect } from 'vitest';
import {
  calculateTotalSplit,
  calculateMaxShare,
  clampShare,
  autoBalanceSplit,
  adjustShareDynamically,
  calculateDonutSegments,
} from '../src/revenue-split';
import { revenueSplitToBps } from '../src/revenue-split';

describe('Math SDK - Revenue Split Allocation', () => {
  describe('calculateTotalSplit', () => {
    it('sums the 4 pillars correctly', () => {
      expect(calculateTotalSplit({ creator: 50, buyback: 10, holders: 20, growth: 20 })).toBe(100);
      expect(calculateTotalSplit({ creator: 25, buyback: 25, holders: 25, growth: 0 })).toBe(75);
    });
  });

  describe('calculateMaxShare & clampShare', () => {
    it('prevents share from exceeding 100 minus others', () => {
      const split = { creator: 50, buyback: 20, holders: 10, growth: 0 }; // others = 30 for creator
      expect(calculateMaxShare(split, 'creator')).toBe(70); // 100 - (20 + 10 + 0) = 70

      // Requesting 90 should clamp to 70
      expect(clampShare(90, split, 'creator')).toBe(70);
      // Requesting 40 is below max, returns 40
      expect(clampShare(40, split, 'creator')).toBe(40);
    });
  });

  describe('autoBalanceSplit', () => {
    it('leaves already balanced 100% split untouched', () => {
      const split = { creator: 50, buyback: 0, holders: 50, growth: 0 };
      expect(autoBalanceSplit(split)).toEqual(split);
    });

    it('balances 80% split up to 100% by adjusting holders', () => {
      const split = { creator: 40, buyback: 0, holders: 40, growth: 0 }; // 80%
      const balanced = autoBalanceSplit(split);
      expect(calculateTotalSplit(balanced)).toBe(100);
      expect(balanced.holders).toBe(60); // 40 + 20 = 60
    });
  });

  describe('adjustShareDynamically', () => {
    it('rebalances other shares when increasing one share from 0 to 20', () => {
      const initial = { creator: 50, buyback: 0, holders: 50, growth: 0 };
      const adjusted = adjustShareDynamically(initial, 'buyback', 20);
      expect(adjusted.buyback).toBe(20);
      expect(calculateTotalSplit(adjusted)).toBe(100);
      // Creator was reduced from 50 to 30
      expect(adjusted.creator).toBe(30);
      expect(adjusted.holders).toBe(50);
    });

    it('rebalances when decreasing one share', () => {
      const initial = { creator: 50, buyback: 20, holders: 30, growth: 0 };
      const adjusted = adjustShareDynamically(initial, 'buyback', 10);
      expect(adjusted.buyback).toBe(10);
      expect(calculateTotalSplit(adjusted)).toBe(100);
      expect(adjusted.creator).toBe(60);
    });
  });

  describe('calculateDonutSegments', () => {
    it('calculates strokes and cumulative offsets for 4-color donut SVG', () => {
      const split = { creator: 50, buyback: 0, holders: 50, growth: 0 };
      const { circumference, segments } = calculateDonutSegments(split, 38);

      expect(circumference).toBeCloseTo(238.76, 1);
      // Creator takes 50%
      expect(segments.creator.stroke).toBeCloseTo(circumference * 0.5, 1);
      expect(segments.creator.offset).toBe(0);

      // Buyback takes 0%
      expect(segments.buyback.stroke).toBe(0);

      // Holders takes 50% and starts where creator ends
      expect(segments.holders.stroke).toBeCloseTo(circumference * 0.5, 1);
      expect(segments.holders.offset).toBeCloseTo(-segments.creator.stroke, 1);
    });
  });
});

describe('revenueSplitToBps', () => {
  it('maps UI shares onto the on-chain splitter and sums to 10,000', () => {
    expect(revenueSplitToBps({ creator: 50, buyback: 20, holders: 20, growth: 10 })).toEqual({
      holdersBps: 2_000,
      burnBps: 2_000,
      creatorBps: 5_000,
      liquidityBps: 1_000,
    });
    const odd = revenueSplitToBps({ creator: 33.3, buyback: 33.3, holders: 33.3, growth: 0 });
    expect(odd.holdersBps + odd.burnBps + odd.creatorBps + odd.liquidityBps).toBe(10_000);
  });

  it('defaults to 100% creator when no split is given', () => {
    expect(revenueSplitToBps(undefined)).toEqual({
      holdersBps: 0,
      burnBps: 0,
      creatorBps: 10_000,
      liquidityBps: 0,
    });
  });
});
