import { describe, it, expect, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { ARC_CHAIN } from '@goton/shared-types';
import {
  curveSwapImpact,
  formatPriceImpact,
  poolOutputAtSpot,
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
