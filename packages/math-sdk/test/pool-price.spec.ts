import { describe, expect, it } from 'vitest';
import {
  constantProductSellAt,
  priceForSellProceeds,
  sqrtPriceX96ToQuotePrice,
} from '../src/pool-price';

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

describe('constantProductSellAt / priceForSellProceeds', () => {
  // A pool holding 4 quote and 2e9 tokens: price 2e-9 quote per token, k = 8e9.
  const k = 4 * 2e9;
  const price = 4 / 2e9;

  it('takes price impact into account', () => {
    // A small sell gets close to spot; selling as many tokens as the pool holds gets half the quote.
    // Selling 1e6 of a 2e9 reserve costs about 0.05% in price impact.
    expect(constantProductSellAt(k, price, 1e6, 0) / (1e6 * price)).toBeCloseTo(0.9995, 4);
    expect(constantProductSellAt(k, price, 2e9, 0)).toBeCloseTo(2, 9);
    expect(constantProductSellAt(k, price, 1e6, 100)).toBeLessThan(1e6 * price * 0.991);
  });

  it('finds the spot price a sell needs, beyond spot × amount for a large one', () => {
    const p = priceForSellProceeds(k, 2e9, 2, 0);
    expect(p).toBeCloseTo(price, 15);
    expect(priceForSellProceeds(k, 2e9, 4, 0)).toBeGreaterThan((4 / 2e9) * 2);
    expect(
      constantProductSellAt(k, priceForSellProceeds(k, 5e8, 1, 100), 5e8, 100),
    ).toBeGreaterThanOrEqual(1 - 1e-9);
  });
});
