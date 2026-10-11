import { describe, it, expect } from 'vitest';
import {
  calculateTotalSplit,
  calculateMaxShare,
  clampShare,
  autoBalanceSplit,
  calculateDonutSegments,
} from '../src/revenue-split';

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
