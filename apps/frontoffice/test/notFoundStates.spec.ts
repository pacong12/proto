// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, type Component } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { ApiError } from '../src/lib/api-client';
import NotFoundPage from '../src/pages/NotFoundPage.vue';
import PostDetailPage from '../src/pages/PostDetailPage.vue';
import ProfileView from '../src/components/profile/ProfileView.vue';

const apiFetch = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/api-client', async (original) => ({
  ...(await original<typeof import('../src/lib/api-client')>()),
  apiFetch,
}));
vi.mock('../src/composables/useWallet', () => ({
  useWallet: () => ({
    account: ref(null),
    activeNetwork: ref({ nativeCurrency: { symbol: 'ETH' }, blockExplorer: '' }),
    openWallet: vi.fn(),
  }),
}));
vi.mock('../src/composables/useTokenStore', () => ({
  useTokenStore: () => ({
    tokens: ref([]),
    fetchTokens: vi.fn().mockResolvedValue(undefined),
    getTokenNetwork: vi.fn(),
  }),
}));
vi.mock('../src/composables/useFeed', () => ({
  isWhaleCaller: () => false,
  useFeed: () => ({
    toggleLike: vi.fn(),
    toggleRepost: vi.fn(),
    recordView: vi.fn(),
    postCallout: vi.fn(),
    fetchUserPosts: vi.fn().mockResolvedValue([]),
  }),
}));
vi.mock('../src/composables/useLaunchpad', () => ({
  useLaunchpad: () => ({ loading: ref(false), error: ref(null) }),
}));
vi.mock('../src/composables/useHolderDividends', () => ({
  useHolderDividends: () => ({
    entries: ref([]),
    loading: ref(false),
    actionLoading: ref(null),
    error: ref(null),
    hasAnyEarned: ref(false),
    loadDividends: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock('../src/composables/useUserProfile', () => ({
  useUserProfile: () => ({
    myLaunches: ref([]),
    portfolioPositions: ref([]),
    userActivities: ref([]),
    loadingLaunches: ref(false),
    claimableTotals: ref(['0.0000 ETH']),
    fetchMyLaunches: vi.fn().mockResolvedValue(undefined),
    fetchUserPositionsAndActivity: vi.fn().mockResolvedValue(undefined),
  }),
}));

async function mountAt(path: string, routePath: string, component: Component, slugProp = false) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, component: { template: '<div />' } },
      { path: '/:other(.*)*', component: { template: '<div />' } },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = shallowMount(component as Component, {
    props: slugProp ? { address: path.slice(1) } : {},
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content');

beforeEach(() => {
  vi.clearAllMocks();
  document.title = 'default';
  document.head.querySelector('meta[name="robots"]')?.remove();
  localStorage.clear();
});

describe('post page', () => {
  it('shows not found, with its title and noindex, when the API says 404', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'Callout not found'));
    const wrapper = await mountAt('/post/nope', '/post/:id', PostDetailPage);
    const page = wrapper.findComponent(NotFoundPage);
    expect(page.exists()).toBe(true);
    expect(page.props('title')).toBe('Post Not Found');
    expect(page.props('homeTo')).toBe('/feed');
    expect(document.title).toContain('Post Not Found');
    expect(robots()).toContain('noindex');
  });

  it('does not call a post missing when the API is only unreachable', async () => {
    apiFetch.mockRejectedValue(new ApiError(500, 'Server error'));
    const wrapper = await mountAt('/post/abc', '/post/:id', PostDetailPage);
    expect(wrapper.findComponent(NotFoundPage).exists()).toBe(false);
    expect(document.title).toBe('default');
    expect(robots()).toBeUndefined();
  });

  it('keeps an existing post indexable, under a title of its own', async () => {
    apiFetch.mockResolvedValue({
      success: true,
      data: {
        id: 'p1',
        content: '$KTUSH8 is the one this week',
        authorAddress: `0x${'1'.repeat(40)}`,
        tokenAddress: '0x',
      },
    });
    const wrapper = await mountAt('/post/p1', '/post/:id', PostDetailPage);
    expect(wrapper.findComponent(NotFoundPage).exists()).toBe(false);
    expect(robots()).not.toContain('noindex');
    expect(document.title).toContain('$KTUSH8 is the one this week');
    expect(document.title).not.toBe('default');
  });
});

describe('profile page', () => {
  it('shows not found, with its title and noindex, for a name nobody has', async () => {
    apiFetch.mockRejectedValue(new ApiError(404, 'User identity could not be resolved'));
    const wrapper = await mountAt('/nosuchuser', '/:username', ProfileView, true);
    expect(wrapper.findComponent(NotFoundPage).exists()).toBe(true);
    expect(document.title).toContain('Profile not found');
    expect(robots()).toContain('noindex');
  });

  it('keeps a wallet with no profile working, without asking who it is', async () => {
    apiFetch.mockResolvedValue({ success: true, data: { profile: null } });
    const wallet = `0x${'a'.repeat(40)}`;
    const wrapper = await mountAt(`/${wallet}`, '/:username', ProfileView, true);
    expect(wrapper.findComponent(NotFoundPage).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ProfileHero' }).exists()).toBe(true);
    expect(document.title).toBe('default');
    expect(apiFetch).not.toHaveBeenCalledWith(`/api/users/${wallet}`);
  });

  it('opens the profile of a name the API knows', async () => {
    const wallet = `0x${'b'.repeat(40)}`;
    apiFetch.mockImplementation(async (url: string) =>
      url.startsWith('/api/users/')
        ? { success: true, data: { address: wallet } }
        : { success: true, data: { profile: null } },
    );
    const wrapper = await mountAt('/SomeRealUser', '/:username', ProfileView, true);
    expect(wrapper.findComponent(NotFoundPage).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ProfileHero' }).exists()).toBe(true);
    expect(document.title).toBe('default');
  });
});
