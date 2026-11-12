import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { ROBINHOOD_CHAIN } from '@goton/shared-types';

const CREATOR = '0x00000000000000000000000000000000000000a1';
const reputation = {
  launches: 4,
  graduated: 2,
  active: 2,
  graduationRate: 0.5,
  totalMarketCapUsd: 250000,
  topToken: { address: '0x1', name: 'Top', symbol: 'TOP', marketCapUsd: 200000 },
};

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(async (path: string) =>
    path.includes('/reputation')
      ? { success: true, data: reputation }
      : { success: true, data: [] },
  ),
}));
vi.mock('@/lib/viem-client', () => ({
  getPublicClient: () => ({ readContract: async () => 0n }),
}));

const { useUserProfile } = await import('../src/composables/useUserProfile');

describe('useUserProfile creator reputation', () => {
  it("fetches and exposes the open profile's reputation", async () => {
    const targetAccount = ref<string | null>(CREATOR);
    const profile = useUserProfile({
      targetAccount,
      activeNetwork: ref(ROBINHOOD_CHAIN),
      allTokens: ref([]),
      getTokenNetwork: () => ROBINHOOD_CHAIN,
    });
    await profile.fetchMyLaunches();
    await Promise.resolve();
    expect(profile.creatorReputation.value).toMatchObject({
      launches: 4,
      graduated: 2,
      graduationRate: 0.5,
      totalMarketCapUsd: 250000,
    });
  });

  it('clears reputation when there is no target wallet', async () => {
    const targetAccount = ref<string | null>(null);
    const profile = useUserProfile({
      targetAccount,
      activeNetwork: ref(ROBINHOOD_CHAIN),
      allTokens: ref([]),
      getTokenNetwork: () => ROBINHOOD_CHAIN,
    });
    await profile.fetchMyLaunches();
    expect(profile.creatorReputation.value).toBeNull();
  });
});
