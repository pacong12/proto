import { describe, it, expect } from 'vitest';
import {
  calculateSpotPrice,
  calculateCurveBuyOutput,
  calculateCurveSellOutput,
  getAmountOutBuyWei,
  getAmountOutSellWei,
  calculatePriceImpact,
  calculateGraduationProgress,
  calculateAntiSnipeTaxBps,
} from '../src/bonding-curve';
import { CURVE_TOKEN_SUPPLY_WEI } from '../src/constants';
import {
  ROBINHOOD_GRADUATION_TARGET_WEI,
  ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI,
} from '../src/chains/robinhood';
import { ARC_MATH_CONFIG, calculateArcV4FdvUsdc } from '../src/chains/arc';

describe('Math SDK - Bonding Curve', () => {
  describe('calculateSpotPrice', () => {
    it('returns zero when reserves are non-positive', () => {
      expect(calculateSpotPrice(0, 100)).toBe(0);
      expect(calculateSpotPrice(100, 0)).toBe(0);
    });

    it('calculates native spot price correctly', () => {
      // 3 ETH / 800,000,000 tokens = 3.75e-9 ETH/token
      const spot = calculateSpotPrice(3, 800_000_000);
      expect(spot).toBeCloseTo(3.75e-9, 11);
    });

    it('multiplies spot price by quote asset USD price', () => {
      // 3.75e-9 ETH * $2500/ETH = $0.000009375
      const usdPrice = calculateSpotPrice(3, 800_000_000, 2500);
      expect(usdPrice).toBeCloseTo(0.000009375, 9);
    });
  });

  describe('calculateCurveBuyOutput & calculateCurveSellOutput (Float Preview)', () => {
    const vEth = 3.0;
    const vToken = 800_000_000;

    it('returns 0 for zero or negative input', () => {
      expect(calculateCurveBuyOutput(0, vEth, vToken)).toBe(0);
      expect(calculateCurveSellOutput(0, vEth, vToken)).toBe(0);
    });

    it('calculates net buy output with 1% fee deduction', () => {
      // Buying with 1 ETH: netEth = 0.99
      // k = 3 * 800M = 2.4B
      // newEth = 3.99
      // newToken = 2.4B / 3.99 = ~601,503,759.4
      // tokenOut = 800M - 601.5M = ~198,496,240.6
      const tokensOut = calculateCurveBuyOutput(1.0, vEth, vToken);
      expect(tokensOut).toBeGreaterThan(190_000_000);
      expect(tokensOut).toBeLessThan(200_000_000);
    });

    it('calculates net sell output with 1% fee deduction', () => {
      // Selling 100M tokens back
      // k = 2.4B
      // newToken = 900M
      // newEth = 2.4B / 900M = 2.666666667
      // grossEth = 3 - 2.666666667 = 0.333333333
      // netEth = grossEth * 0.99 = ~0.33
      const ethOut = calculateCurveSellOutput(100_000_000, vEth, vToken);
      expect(ethOut).toBeCloseTo(0.33, 2);
    });
  });

  describe('getAmountOutBuyWei & getAmountOutSellWei (Solidity Precision)', () => {
    it('matches exact integer arithmetic of BondingCurve.sol for buy', () => {
      const ethInWei = 1000000000000000000n; // 1 ETH
      const { tokenOutWei, feeEthWei } = getAmountOutBuyWei(
        ethInWei,
        ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI,
        CURVE_TOKEN_SUPPLY_WEI,
      );

      // 1% of 1 ETH = 0.01 ETH fee
      expect(feeEthWei).toBe(10000000000000000n);
      expect(tokenOutWei).toBeGreaterThan(0n);
    });

    it('matches exact integer arithmetic of BondingCurve.sol for sell', () => {
      const tokensInWei = 100000000n * 10n ** 18n; // 100M tokens
      const { ethOutWei, feeEthWei } = getAmountOutSellWei(
        tokensInWei,
        ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI,
        CURVE_TOKEN_SUPPLY_WEI,
      );

      expect(feeEthWei).toBeGreaterThan(0n);
      expect(ethOutWei).toBeGreaterThan(0n);
    });
  });

  describe('calculatePriceImpact', () => {
    it('calculates price impact percentage accurately', () => {
      // 0.3 ETH into 3 ETH reserve -> 0.3 / 3.3 * 100 = 9.09%
      const impact = calculatePriceImpact(0.3, 3.0);
      expect(impact).toBeCloseTo(9.09, 2);
    });
  });

  describe('calculateGraduationProgress', () => {
    it('computes 0% when no eth raised', () => {
      expect(calculateGraduationProgress(0n, ROBINHOOD_GRADUATION_TARGET_WEI)).toBe(0);
    });

    it('computes 50% when half target reached', () => {
      const halfTarget = ROBINHOOD_GRADUATION_TARGET_WEI / 2n;
      expect(calculateGraduationProgress(halfTarget, ROBINHOOD_GRADUATION_TARGET_WEI)).toBeCloseTo(
        0.5,
        4,
      );
    });

    it('caps progress at 1.0 (100%)', () => {
      const overTarget = ROBINHOOD_GRADUATION_TARGET_WEI * 2n;
      expect(calculateGraduationProgress(overTarget, ROBINHOOD_GRADUATION_TARGET_WEI)).toBe(1.0);
    });
  });

  describe('calculateAntiSnipeTaxBps', () => {
    it('implements BondingCurve.sol decaying tax schedule', () => {
      expect(calculateAntiSnipeTaxBps(0)).toBe(9900n); // 99%
      expect(calculateAntiSnipeTaxBps(1)).toBe(2500n); // 25%
      expect(calculateAntiSnipeTaxBps(2)).toBe(300n); // 3%
      expect(calculateAntiSnipeTaxBps(3)).toBe(0n); // 0%
      expect(calculateAntiSnipeTaxBps(10)).toBe(0n); // 0%
    });
  });
});

describe('Math SDK - Arc in-pool v4 equivalence', () => {
  it('reproduces the on-chain prebuy from the equivalent virtual reserves', () => {
    // Fork test: 4.50 USDC prebuy with 1% hook tax + 1% pool fee bought 1,774,718.628 tokens.
    const virtualUsdc = Number(ARC_MATH_CONFIG.virtualQuoteReserve) / 1e18;
    const out = calculateCurveBuyOutput(4.5 * 0.99, virtualUsdc, 1e9, 1e9);
    expect(out).toBeCloseTo(1_774_718.628, 0);
  });

  it('opens and graduates at the Argus market caps', () => {
    expect(calculateArcV4FdvUsdc(ARC_MATH_CONFIG.initialTick)).toBeCloseTo(
      ARC_MATH_CONFIG.openingFdvUsdc,
      1,
    );
    expect(calculateArcV4FdvUsdc(ARC_MATH_CONFIG.bondTick)).toBeCloseTo(
      ARC_MATH_CONFIG.graduationFdvUsdc,
      0,
    );
    expect(calculateArcV4FdvUsdc(-ARC_MATH_CONFIG.initialTick, 1e9, false)).toBeCloseTo(
      ARC_MATH_CONFIG.openingFdvUsdc,
      1,
    );
  });
});
