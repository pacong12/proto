import { describe, it, expect } from 'vitest';
import {
  taxPercentToBps,
  taxBpsToPercent,
  calculateNetTokenAfterBuyTax,
  calculateNetQuoteAfterSellTax,
  calculateLaunchTotalDue,
  MAX_TAX_BPS,
} from '../src/tax';

describe('Math SDK - Trading Tax Calculations', () => {
  describe('taxPercentToBps & taxBpsToPercent', () => {
    it('converts percent to bps and clamps at MAX_TAX_BPS (1000 = 10%)', () => {
      expect(taxPercentToBps(1.0)).toBe(100);
      expect(taxPercentToBps(5.5)).toBe(550);
      expect(taxPercentToBps(10.0)).toBe(1000);
      expect(taxPercentToBps(25.0)).toBe(MAX_TAX_BPS); // Capped at 1000 bps
      expect(taxPercentToBps(-5)).toBe(0);
    });

    it('converts bps back to human percent', () => {
      expect(taxBpsToPercent(100)).toBe(1.0);
      expect(taxBpsToPercent(550)).toBe(5.5);
      expect(taxBpsToPercent(1000)).toBe(10.0);
      expect(taxBpsToPercent(0)).toBe(0);
    });
  });

  describe('calculateNetTokenAfterBuyTax', () => {
    it('deducts buy tax correctly from gross tokens', () => {
      // Buying 1000 tokens with 5% buy tax -> 950 net tokens
      expect(calculateNetTokenAfterBuyTax(1000, 5)).toBe(950);
    });

    it('caps tax deduction at MAX_TAX_PERCENT (10%)', () => {
      // 1000 tokens with 20% input -> capped at 10% -> 900 net tokens
      expect(calculateNetTokenAfterBuyTax(1000, 20)).toBe(900);
    });
  });

  describe('calculateNetQuoteAfterSellTax', () => {
    it('deducts sell tax correctly from gross proceeds', () => {
      // Selling tokens for 2.0 ETH gross with 5% sell tax -> 1.9 ETH net
      expect(calculateNetQuoteAfterSellTax(2.0, 5)).toBeCloseTo(1.9, 4);
    });
  });

  describe('calculateLaunchTotalDue', () => {
    it('sums platform creation fee and initial developer buy', () => {
      // Launch fee 0.0005 ETH + 0.1 ETH initial buy = 0.1005 ETH
      expect(calculateLaunchTotalDue(0.0005, 0.1)).toBeCloseTo(0.1005, 6);
      // Arc: 1.00 USDC + 100 USDC initial buy = 101.00 USDC
      expect(calculateLaunchTotalDue(1.0, 100.0)).toBe(101.0);
    });
  });
});
