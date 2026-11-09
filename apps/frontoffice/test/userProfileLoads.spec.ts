import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { ROBINHOOD_CHAIN } from '@goton/shared-types';

const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const SOLD = '0x00000000000000000000000000000000000000c1';
const HELD = '0x00000000000000000000000000000000000000c2';

const position = (tokenAddress: string, symbol: string) => ({
  tokenAddress,
  name: symbol,
  symbol,
  balanceFormatted: '1',
  priceUsd: 1,
  valueUsd: 1,
});

let releaseA: () => void = () => {};
const aSettled = new Promise<void>((r) => (releaseA = r));

vi.mock('@/lib/api-client', () => ({
  apiFetch: async (path: string) => {
    if (path.includes(A)) await aSettled;
    if (path.includes('/portfolio')) {
      // The indexer still lists SOLD for B, whose on-chain balance is already 0.
      return {
        success: true,
        data: path.includes(A) ? [position(HELD, 'AAA')] : [position(SOLD, 'OLD')],
      };
    }
    return { success: true, data: [] };
  },
}));
vi.mock('@/lib/viem-client', () => ({
  getPublicClient: () => ({ readContract: async () => 0n }),
}));

describe('useUserProfile', () => {
  it("keeps the open profile's positions and drops what is empty on-chain", async () => {
    const { useUserProfile } = await import('../src/composables/useUserProfile');
    const targetAccount = ref<string | null>(A);
    const profile = useUserProfile({
      targetAccount,
      activeNetwork: ref(ROBINHOOD_CHAIN),
      allTokens: ref([]),
      getTokenNetwork: () => ROBINHOOD_CHAIN,
    });

    const forA = profile.fetchUserPositionsAndActivity();
    targetAccount.value = B;
    await profile.fetchUserPositionsAndActivity();
    releaseA();
    await forA;

    // Not A's position, and not B's sold-out one the indexer still lists.
    expect(profile.portfolioPositions.value).toEqual([]);
    expect(profile.loadingPortfolio.value).toBe(false);
  });
});
