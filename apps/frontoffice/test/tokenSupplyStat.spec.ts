// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BondingCurveStats from '../src/components/trade/BondingCurveStats.vue';
import { burnedRaw } from '../src/lib/holders';

const ONE_B = (10n ** 27n).toString();
const token = {
  address: '0x00000000000000000000000000000000000000aa',
  symbol: 'T',
  decimals: 18,
  totalSupply: ONE_B,
  version: 'v4',
  poolAddress: '',
};
const market = {
  marketCapUsd: 1,
  priceUsd: 1,
  volume24hUsd: 0,
  isGraduated: false,
  graduationThresholdWeth: '4.2',
  pairedPrincipalWeth: '0',
};

describe('token supply on the detail page', () => {
  it('shows the supply', () => {
    const wrapper = mount(BondingCurveStats, {
      props: { currentToken: token as never, currentMarketData: market as never },
    });
    expect(wrapper.text()).toContain('Supply');
    expect(wrapper.text()).toContain('1B');
  });

  it('takes burned tokens off it: 0xdEaD still counts in totalSupply on-chain', () => {
    const burned = burnedRaw([
      {
        address: '0x000000000000000000000000000000000000dEaD',
        percent: 1.18,
        balance: (11_796_964n * 10n ** 18n).toString(),
      },
      {
        address: '0x00000000000000000000000000000000000000c1',
        percent: 30,
        balance: (3n * 10n ** 26n).toString(),
      },
    ]);
    expect(burned).toBe(11_796_964n * 10n ** 18n);
    const wrapper = mount(BondingCurveStats, {
      props: {
        currentToken: token as never,
        currentMarketData: market as never,
        burnedInfo: { percent: 1.18, raw: burned },
      },
    });
    expect(wrapper.text()).toContain('988.2M');
    expect(wrapper.html()).toContain('1,000,000,000 minted, 11,796,964 burned');
  });
});
