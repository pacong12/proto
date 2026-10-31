import { describe, expect, it } from 'vitest';
import { sqrtPriceX96ToQuotePrice } from '../src/pool-price';

/** sqrtPriceX96 of a raw token1-per-token0 price. */
const sqrtOf = (rawPrice: number) => BigInt(Math.round(Math.sqrt(rawPrice) * 2 ** 96));

describe('sqrtPriceX96ToQuotePrice', () => {
  it('reads an 18-decimal quote on either side of the pool', () => {
    // 1 token = 2e-9 ETH
    expect(sqrtPriceX96ToQuotePrice(sqrtOf(2e-9), true, 18)).toBeCloseTo(2e-9, 15);
    expect(sqrtPriceX96ToQuotePrice(sqrtOf(1 / 2e-9), false, 18)).toBeCloseTo(2e-9, 15);
  });

  it('adjusts for a 6-decimal quote (USDC)', () => {
    // 1 token = 0.000004 USDC: raw USDC units per raw token unit = 4e-6 × 1e6 / 1e18
    const raw = (4e-6 * 1e6) / 1e18;
    expect(sqrtPriceX96ToQuotePrice(sqrtOf(raw), true, 6)).toBeCloseTo(4e-6, 12);
    expect(sqrtPriceX96ToQuotePrice(sqrtOf(1 / raw), false, 6)).toBeCloseTo(4e-6, 12);
  });

  it('gives 0 for an empty pool', () => {
    expect(sqrtPriceX96ToQuotePrice(0n, true, 18)).toBe(0);
  });
});
