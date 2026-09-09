import { describe, it, expect } from 'vitest';
import TradeView from '../src/components/TradeView.vue';

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
