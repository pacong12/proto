import { describe, expect, it, vi } from 'vitest';
import { ROBINHOOD_CHAIN } from '@goton/shared-types';

const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const TOKEN = '0x00000000000000000000000000000000000000cc';

// Wallet A's read settles only when released, after wallet B's.
let releaseA: () => void = () => {};
const aSettled = new Promise<void>((r) => (releaseA = r));

vi.mock('@goton/shared-types', async (orig) => ({
  ...(await orig<typeof import('@goton/shared-types')>()),
  resolveFeeSplitter: async () => ({
    address: '0x00000000000000000000000000000000000000dd',
    quoteDecimals: 18,
  }),
}));
vi.mock('../src/lib/viem-client', () => ({
  getPublicClient: () => ({
    readContract: async ({ args: [holder] }: { args: [string] }) => {
      if (holder === A) await aSettled;
      return holder === A ? 111n : 222n;
    },
  }),
}));

describe('useHolderDividends', () => {
  it("never shows an earlier wallet's dividends after a newer load", async () => {
    const { useHolderDividends } = await import('../src/composables/useHolderDividends');
    const { entries, loading, loadDividends, reset } = useHolderDividends();
    const tokens = [{ address: TOKEN, symbol: 'T', name: 'T' }] as const;
    const net = () => ROBINHOOD_CHAIN;

    const forA = loadDividends(A, [...tokens], net);
    reset();
    await loadDividends(B, [...tokens], net);
    releaseA();
    await forA;

    expect(entries.value.map((e) => e.earnedWei)).toEqual([222n]);
    expect(loading.value).toBe(false);
  });
});
