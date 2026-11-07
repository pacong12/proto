import { describe, expect, it } from 'vitest';
import { callPnl, isCallInProfit } from '../src/lib/call-pnl';
import { useFeed } from '../src/composables/useFeed';
import type { FeedCalloutItem } from '@goton/shared-types';

describe('callPnl', () => {
  it('measures a call from its entry price', () => {
    expect(callPnl({ priceAtPost: 1, tokenPriceUsd: 1.5, positionUsd: 100 })).toEqual({
      pct: 50,
      usd: 50,
    });
    expect(callPnl({ priceAtPost: 2, tokenPriceUsd: 1 })).toEqual({ pct: -50, usd: null });
  });

  it('has no result without both prices', () => {
    expect(callPnl({})).toBeNull();
    expect(callPnl({ priceAtPost: 1 })).toBeNull();
    expect(callPnl({ tokenPriceUsd: 1 })).toBeNull();
  });
});

describe('In Profit tab', () => {
  const call = (id: string, fields: Partial<FeedCalloutItem>) =>
    ({ id, content: '', authorAddress: '0x1', ...fields }) as FeedCalloutItem;

  it('lists the calls whose token trades above the entry, not self-reported profit', () => {
    const { callouts, activeFilter, filteredCallouts } = useFeed();
    callouts.value = [
      call('up', { priceAtPost: 1, tokenPriceUsd: 2 }),
      call('down', { priceAtPost: 2, tokenPriceUsd: 1, profitUsd: 500 }),
      call('flat', { priceAtPost: 1, tokenPriceUsd: 1 }),
      call('unpriced', { profitUsd: 500 }),
    ];
    activeFilter.value = 'profit';
    expect(filteredCallouts.value.map((c) => c.id)).toEqual(['up']);
    expect(isCallInProfit({ priceAtPost: 1, tokenPriceUsd: 1 })).toBe(false);
  });
});
