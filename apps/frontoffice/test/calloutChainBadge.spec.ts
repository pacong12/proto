// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { ARC_NETWORK, ROBINHOOD_NETWORK, type FeedCalloutItem } from '@goton/shared-types';
import FeedCalloutTokenPanel from '../src/components/feed/FeedCalloutTokenPanel.vue';

// The viewer's token list does not hold this token, so a lookup by address alone lands on the
// default chain (Robinhood).
vi.mock('../src/composables/useTokenStore', () => ({
  useTokenStore: () => ({ tokens: ref([]), getTokenNetwork: () => ROBINHOOD_NETWORK }),
}));

describe('callout chain badge', () => {
  it("shows the token's own chain from its paired token, not the default chain", () => {
    const call = {
      id: 'c1',
      tokenAddress: '0xd1fa6f2e9361fc317a902f8c5cd3b7a3edc879d9',
      tokenPairedToken: ARC_NETWORK.contracts.weth,
      authorAddress: '0x0000000000000000000000000000000000000001',
      content: 'gm',
      createdAt: 0,
      tokenSymbol: 'KTU',
    } as unknown as FeedCalloutItem;
    const wrapper = shallowMount(FeedCalloutTokenPanel, { props: { call, pinned: false } });
    const badge = wrapper.find(`img[title="${ARC_NETWORK.name}"]`);
    expect(badge.exists()).toBe(true);
    expect(badge.attributes('src')).toBe(ARC_NETWORK.icon);
  });
});
