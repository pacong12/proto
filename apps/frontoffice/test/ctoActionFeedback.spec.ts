// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { computed, ref } from 'vue';

const TOKEN = '0x00000000000000000000000000000000000000aa';
const RECIPIENT = '0x00000000000000000000000000000000000000bb';
const TX = '0xabc';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  propose: vi.fn(),
  readRedirectState: vi.fn(async () => null),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/u', params: {}, query: {}, meta: {} }),
}));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));
vi.mock('@/composables/useWallet', () => ({
  useWallet: () => ({
    account: ref(RECIPIENT),
    activeNetwork: ref({ chainId: 1, nativeCurrency: { symbol: 'ETH' } }),
    openWallet: vi.fn(),
  }),
}));
const launchpadError = ref<string | null>(null);
vi.mock('@/composables/useLaunchpad', () => ({
  useLaunchpad: () => ({
    claimFees: vi.fn(),
    readRedirectState: mocks.readRedirectState,
    proposeCreatorRecipient: mocks.propose,
    acceptCreatorRecipient: vi.fn(),
    cancelCreatorRecipient: vi.fn(),
    lockCreatorRecipient: vi.fn(),
    error: launchpadError,
  }),
}));
vi.mock('@/composables/useFeed', () => ({
  useFeed: () => ({
    fetchUserPosts: vi.fn(async () => []),
    toggleLike: vi.fn(),
    toggleRepost: vi.fn(),
  }),
}));
vi.mock('@/composables/useTokenStore', () => ({
  useTokenStore: () => ({
    tokens: ref([]),
    fetchTokens: vi.fn(async () => undefined),
    getTokenNetwork: () => ({ chainId: 1 }),
  }),
}));
vi.mock('@/composables/useUserProfile', () => ({
  useUserProfile: () => ({
    myLaunches: ref([]),
    portfolioPositions: ref([]),
    userActivities: ref([]),
    loadingLaunches: ref(false),
    totalClaimableWeth: ref('0'),
    fetchMyLaunches: vi.fn(async () => undefined),
    fetchUserPositionsAndActivity: vi.fn(async () => undefined),
  }),
}));
vi.mock('@/composables/useHolderDividends', () => ({
  useHolderDividends: () => ({
    entries: ref([]),
    loading: ref(false),
    actionLoading: ref(null),
    error: ref(null),
    totalEarnedFormatted: computed(() => '0.0000'),
    hasAnyEarned: computed(() => false),
    loadDividends: vi.fn(),
    claimDividend: vi.fn(),
    claimAllDividends: vi.fn(),
    reset: vi.fn(),
  }),
}));

import ProfileView from '../src/components/profile/ProfileView.vue';
import CtoRedirectModal from '../src/components/profile/CtoRedirectModal.vue';

function mountOpenModal() {
  const wrapper = shallowMount(ProfileView);
  (wrapper.vm as unknown as { openCtoModal(token: string): void }).openCtoModal(TOKEN);
  return wrapper;
}

describe('ProfileView CTO actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    launchpadError.value = null;
  });

  it('confirms with a toast once the transaction is through', async () => {
    mocks.propose.mockResolvedValue(TX);
    const wrapper = mountOpenModal();
    await flushPromises();

    wrapper.findComponent(CtoRedirectModal).vm.$emit('propose', RECIPIENT);
    await flushPromises();

    expect(mocks.propose).toHaveBeenCalledWith(TOKEN, RECIPIENT, 1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('ctoActionDone');
  });

  it('stays quiet when the wallet sends nothing', async () => {
    mocks.propose.mockResolvedValue(null);
    launchpadError.value = 'rejected';
    const wrapper = mountOpenModal();
    await flushPromises();

    wrapper.findComponent(CtoRedirectModal).vm.$emit('propose', RECIPIENT);
    await flushPromises();

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(wrapper.findComponent(CtoRedirectModal).props('error')).toBe('rejected');
  });
});
