import { describe, expect, it } from 'vitest';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '@goton/shared-types';
import {
  buyMinOut,
  priceAtMarketCap,
  sellMinOut,
  stopPriceX36,
  toScaled,
} from '../src/lib/limit-orders';

// A Robinhood token: 1e9 supply, 3e-9 ETH per token, ETH at $2000 -> $6,000 market cap.
const ctx = {
  priceInQuote: 3e-9,
  priceUsd: 6e-6,
  supply: 1e9,
  quoteDecimals: 18,
  tokenDecimals: 18,
};

describe('limit order math', () => {
  it('scales decimals exactly, also far beyond 2^53', () => {
    expect(toScaled(1.5, 2)).toBe(150n);
    expect(toScaled(3e-9, 36)).toBe(3n * 10n ** 27n);
    expect(toScaled(0, 18)).toBe(0n);
    expect(toScaled(1e-30, 18)).toBe(0n);
  });

  it('turns a market cap target into a price', () => {
    expect(priceAtMarketCap(3_000, ctx)).toBeCloseTo(1.5e-9, 20); // half the market cap, half the price
  });

  it('limit buy floor takes out executor fee, venue fee and buy tax', () => {
    const price = priceAtMarketCap(3_000, ctx);
    const out = buyMinOut(0.01, price, 1_000, ctx); // 10% creator tax
    const expected = ((0.01 * 0.999) / 1.5e-9) * 0.99 * 0.9;
    expect(Number(out) / 1e18).toBeCloseTo(expected, 0);
  });

  it('sell floors use quote decimals and slippage', () => {
    const usdc = { ...ctx, quoteDecimals: 6, priceInQuote: 6e-6, priceUsd: 6e-6 };
    // 1M tokens at 1e-5 USDC, 1% venue fee, no tax, 3% slippage
    expect(sellMinOut(1_000_000, 1e-5, 0, usdc, 300)).toBe(
      BigInt(Math.floor(10 * 0.99 * 0.97 * 1e6)),
    );
  });

  it('stop price matches the contract unit (quote raw per token raw x 1e36)', () => {
    expect(stopPriceX36(3e-9, ctx)).toBe(toScaled(3e-9, 36));
    const usdc = { ...ctx, quoteDecimals: 6 };
    expect(stopPriceX36(7e-6, usdc)).toBe(7n * 10n ** 18n); // 7e-6 * 1e6 / 1e18 * 1e36
  });
});

describe('order payout', () => {
  it('shows tokens for a filled buy and the quote for a filled sell', async () => {
    const { orderPayout, formatRawAmount } = await import('../src/lib/limit-orders');
    expect(formatRawAmount(1_500_000n * 10n ** 18n, 18)).toBe((1_500_000).toLocaleString());
    expect(
      orderPayout(
        { isBuy: true, status: 'filled', amountOut: String(2n * 10n ** 18n) },
        'PROT',
        ROBINHOOD_CHAIN,
      ),
    ).toBe('2 PROT');
    // Arc pays out the 6-decimal USDC ERC-20.
    expect(
      orderPayout({ isBuy: false, status: 'filled', amountOut: '12500000' }, 'X', ARC_CHAIN),
    ).toBe(`${(12.5).toLocaleString()} USDC`);
    expect(
      orderPayout({ isBuy: false, status: 'cancelled', amountOut: '1' }, 'X', ROBINHOOD_CHAIN),
    ).toBeNull();
  });
});
