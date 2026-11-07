// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProfileCreatedTab from '../src/components/profile/ProfileCreatedTab.vue';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const claimButton = (unclaimedRaw: bigint | null) =>
  mount(ProfileCreatedTab, {
    props: {
      myLaunches: [
        {
          address: '0x00000000000000000000000000000000000000aa',
          name: 'Token',
          symbol: 'TKN',
          unclaimedRaw,
        },
      ],
      loading: false,
      isOwnProfile: true,
      claimingToken: null,
      loadingAction: false,
    } as never,
    global: { stubs: { RouterLink: true } },
  })
    .findAll('button')
    .find((button) => button.text().includes('Claim Fees'))!;

describe('ProfileCreatedTab claim', () => {
  it('offers no transaction when nothing has accrued', () => {
    expect(claimButton(0n).attributes('disabled')).toBeDefined();
    expect(claimButton(1n).attributes('disabled')).toBeUndefined();
  });

  it('keeps the claim when the balance could not be read', () => {
    expect(claimButton(null).attributes('disabled')).toBeUndefined();
  });
});
