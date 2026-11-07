import { describe, it, expect, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { ARC_CHAIN } from '@goton/shared-types';
import {
  curveSwapImpact,
  formatPriceImpact,
  poolOutputAtSpot,
  poolOutputFromLiquidity,
  poolSwapImpact,
  readPoolTaxBps,
} from '../src/lib/pool-preview';
import { formatTradeUsd } from '../src/lib/utils';

describe('poolOutputAtSpot', () => {
  it('takes the tax and the LP fee off a buy: the real pool on Arc pays this', () => {
    // Measured on Arc testnet: 1 USDC at spot 0.0000025233, 3% tax, paid 380,427 tokens.
    const tokens = poolOutputAtSpot(1, 0.000002523296, true, 300);
    expect(tokens).toBeCloseTo((1 / 0.000002523296) * 0.99 * 0.97, 3);
    expect(Math.abs(tokens / 380_427 - 1)).toBeLessThan(0.001);
  });

  it('takes the tax and the LP fee off a sell', () => {
    expect(poolOutputAtSpot(1_000, 0.002, false, 1_000)).toBeCloseTo(2 * 0.99 * 0.9, 9);
  });

  it('is zero without a price, not an invented figure', () => {
    expect(poolOutputAtSpot(1, 0, true, 300)).toBe(0);
  });
});

describe('poolOutputFromLiquidity', () => {
  const Q96 = 2 ** 96;
  // 1 quote raw = 1,000,000 token raw when the quote is currency0 (native ETH sorts first).
  const sqrtPriceX96 = 1000n * (1n << 96n);
  const liquidity = 10n ** 24n;

  /** Independent check: the range as virtual reserves x·y = L², in floating point. */
  function virtualReserves(inputIsCurrency0: boolean, input: number): number {
    const sqrtP = Number(sqrtPriceX96) / Q96;
    const L = Number(liquidity);
    const x = L / sqrtP;
    const y = L * sqrtP;
    return inputIsCurrency0 ? y - (L * L) / (x + input) : x - (L * L) / (y + input);
  }

  const near = (actual: bigint | null, expected: number) => {
    expect(actual).not.toBeNull();
    // The float reference subtracts near-equal reserves, so it is the less precise side.
    expect(Math.abs(Number(actual) / expected - 1)).toBeLessThan(1e-6);
  };

  it.each([true, false])(
    'sells along the curve, then takes the tax off the quote (quote is currency0: %s)',
    (quoteIsCurrency0) => {
      const amountInRaw = 5n * 10n ** 25n;
      const out = poolOutputFromLiquidity({
        isBuy: false,
        amountInRaw,
        sqrtPriceX96,
        liquidity,
        quoteIsCurrency0,
        taxBps: 1000,
      });
      // The token sold is currency1 when the quote is currency0.
      near(out, virtualReserves(!quoteIsCurrency0, Number(amountInRaw) * 0.99) * 0.9);
    },
  );

  it.each([true, false])(
    'taxes a buy before it swaps, then takes the LP fee (quote is currency0: %s)',
    (quoteIsCurrency0) => {
      const amountInRaw = 3n * 10n ** 19n;
      const out = poolOutputFromLiquidity({
        isBuy: true,
        amountInRaw,
        sqrtPriceX96,
        liquidity,
        quoteIsCurrency0,
        taxBps: 300,
      });
      near(out, virtualReserves(quoteIsCurrency0, Number(amountInRaw) * 0.97 * 0.99));
    },
  );

  it('meets spot for a tiny sell and falls below it as the sell grows', () => {
    const impact = (amountInRaw: bigint) =>
      poolSwapImpact({
        isBuy: false,
        amountInRaw,
        amountOutRaw: poolOutputFromLiquidity({
          isBuy: false,
          amountInRaw,
          sqrtPriceX96,
          liquidity,
          quoteIsCurrency0: true,
          taxBps: 1000,
        }) as bigint,
        sqrtPriceX96,
        quoteIsCurrency0: true,
        taxBps: 1000,
      }) as number;
    // The token side of the range: L·sqrtP raw.
    const tokenReserve = liquidity * 1000n;

    expect(impact(10n ** 18n)).toBeLessThan(1e-5);
    // Selling ~2% of the reserve: the sell the Robinhood fork priced 2.2% high at spot.
    const twoPercent = tokenReserve / 50n;
    expect(impact(twoPercent)).toBeGreaterThan(0.019);
    expect(impact(twoPercent)).toBeLessThan(0.021);
    expect(impact(twoPercent * 10n)).toBeGreaterThan(impact(twoPercent));
  });

  it('gives nothing to show for an empty pool or input', () => {
    const base = { isBuy: true, sqrtPriceX96, quoteIsCurrency0: true, taxBps: 0 };
    expect(poolOutputFromLiquidity({ ...base, amountInRaw: 1n, liquidity: 0n })).toBeNull();
    expect(poolOutputFromLiquidity({ ...base, amountInRaw: 0n, liquidity })).toBeNull();
    expect(
      poolOutputFromLiquidity({ ...base, amountInRaw: 1n, liquidity, sqrtPriceX96: 0n }),
    ).toBeNull();
  });
});

describe('poolSwapImpact', () => {
  // 1 quote raw = 1,000 token raw: sqrt(1000) when the quote is currency0.
  const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(1_000) * 2 ** 96));

  it('is what is left after spot, tax and fee', () => {
    const atSpot = 1_000_000 * 1_000 * 0.99 * 0.97;
    const impact = poolSwapImpact({
      isBuy: true,
      amountInRaw: 1_000_000n,
      amountOutRaw: BigInt(Math.floor(atSpot * 0.98)),
      sqrtPriceX96,
      quoteIsCurrency0: true,
      taxBps: 300,
    });
    expect(impact).toBeCloseTo(0.02, 6);
  });

  it('reads the price the right way up on either side of the pool', () => {
    const impact = poolSwapImpact({
      isBuy: false,
      amountInRaw: 1_000_000n,
      amountOutRaw: BigInt(Math.floor(1_000_000 * 1_000 * 0.99)),
      sqrtPriceX96,
      quoteIsCurrency0: false,
      taxBps: 0,
    });
    expect(impact).toBeCloseTo(0, 6);
  });

  it('is never negative', () => {
    expect(curveSwapImpact(2, 1)).toBe(0);
  });
});

describe('formatPriceImpact', () => {
  it('admits when it could not measure', () => {
    expect(formatPriceImpact(null)).toBe('—');
  });

  it('keeps the small figure and shows a real one', () => {
    expect(formatPriceImpact(0.0004)).toBe('< 0.1%');
    expect(formatPriceImpact(0.0123)).toBe('1.23%');
    expect(formatPriceImpact(0.25)).toBe('25.0%');
  });
});

describe('readPoolTaxBps', () => {
  const TOKEN = '0xD1Fa6F2E9361FC317A902F8C5cd3B7a3eDC879d9' as const;

  it("reads the hook's fixed tax, which an in-pool token does not hold itself", async () => {
    const readContract = vi.fn(async () => [TOKEN, TOKEN, TOKEN, 300, 500]);
    const client = { readContract } as unknown as PublicClient;
    await expect(readPoolTaxBps(client, ARC_CHAIN, TOKEN)).resolves.toEqual({
      buyTaxBps: 300,
      sellTaxBps: 500,
    });
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'pools' }));
  });

  it('is null for a token without a registered pool', async () => {
    const zero = '0x0000000000000000000000000000000000000000';
    const client = {
      readContract: async () => [zero, zero, zero, 0, 0],
    } as unknown as PublicClient;
    await expect(readPoolTaxBps(client, ARC_CHAIN, TOKEN)).resolves.toBeNull();
  });
});

describe('formatTradeUsd', () => {
  it('shows a dash for a trade worth nothing or unpriced, never "$0.01"', () => {
    for (const unknown of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatTradeUsd(unknown)).toBe('—');
    }
  });

  it('keeps tiny values honest', () => {
    expect(formatTradeUsd(0.004)).toBe('<$0.01');
  });

  it('shows the true value otherwise', () => {
    expect(formatTradeUsd(0.01)).toBe('$0.01');
    expect(formatTradeUsd(1234.5)).toBe('$1,234.50');
  });
});
