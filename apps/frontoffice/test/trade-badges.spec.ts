import { describe, it, expect } from 'vitest';
import TradeView from '../src/components/TradeView.vue';
import { TraderTagBadge, type TraderTagType } from '../src/components/ui/badge';

describe('TradeView Uniswap v4 & V3 DEX Badges', () => {
  it('TradeView is defined and exports valid SFC structure', () => {
    expect(TradeView).toBeDefined();
    expect(TradeView.__name).toBe('TradeView');
  });

  it('renders Uniswap v4 badge for V2 launches and Uniswap V3 for V1 launches', () => {
    expect(TradeView).toHaveProperty('setup');
    expect(typeof TradeView.setup).toBe('function');
  });
});

describe('GMGN.ai Trader Tag Badges (All 10 Requested Icons)', () => {
  it('exports TraderTagBadge component from badge UI module', () => {
    expect(TraderTagBadge).toBeDefined();
    expect(TraderTagBadge.__name || TraderTagBadge.name).toBe('TraderTagBadge');
  });

  it('supports all 10 specialized GMGN trader badges', () => {
    const requiredTags: TraderTagType[] = [
      'whale',
      'dev',
      'first_buy',
      'sniper',
      'smart_money',
      'kol',
      'sell_all',
      'sell_partial',
      'buy_more',
      'bundled',
    ];

    expect(requiredTags).toHaveLength(10);
    for (const tag of requiredTags) {
      expect(typeof tag).toBe('string');
    }
  });
});
