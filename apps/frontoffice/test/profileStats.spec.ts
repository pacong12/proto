// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProfileStats from '../src/components/profile/ProfileStats.vue';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const statsWith = (totalTradesCapped: boolean) =>
  mount(ProfileStats, {
    props: {
      claimableTotals: [],
      createdTokensCount: 0,
      isOwnProfile: false,
      activePositionsCount: 0,
      totalTradesCount: 100,
      totalTradesCapped,
    },
  }).text();

describe('ProfileStats total trades', () => {
  it('shows a full page of trades as a lower bound', () => {
    expect(statsWith(true)).toContain('100+');
    expect(statsWith(false)).not.toContain('100+');
  });
});
