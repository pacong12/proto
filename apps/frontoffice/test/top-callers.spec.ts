import { describe, expect, it } from 'vitest';
import type { FeedCalloutItem } from '@goton/shared-types';
import { rankCallers } from '../src/lib/top-callers';

const call = (over: Partial<FeedCalloutItem>): FeedCalloutItem =>
  ({
    id: Math.random().toString(),
    tokenAddress: '0xt',
    authorAddress: '0xa',
    content: '',
    likesCount: 0,
    createdAt: 0,
    callType: 'call',
    ...over,
  }) as FeedCalloutItem;

describe('rankCallers', () => {
  it('ranks callers by profit since their calls', () => {
    const ranked = rankCallers([
      // A: $100 position doubled (+$100), and a $50 position halved (-$25).
      call({
        authorAddress: '0xA',
        priceAtPost: 1,
        tokenPriceUsd: 2,
        positionUsd: 100,
        tokenSymbol: 'UP',
      }),
      call({ authorAddress: '0xa', priceAtPost: 2, tokenPriceUsd: 1, positionUsd: 50 }),
      // B: $1000 position up 20% (+$200).
      call({ authorAddress: '0xB', priceAtPost: 1, tokenPriceUsd: 1.2, positionUsd: 1000 }),
    ]);
    expect(ranked.map((r) => r.address.toLowerCase())).toEqual(['0xb', '0xa']);
    expect(ranked[0].profitUsd).toBeCloseTo(200, 6);
    expect(ranked[1]).toMatchObject({ calls: 2, bestSymbol: 'UP' });
    expect(ranked[1].profitUsd).toBeCloseTo(75, 6);
    expect(ranked[1].bestPct).toBeCloseTo(100, 6);
  });

  it('skips replies and comments, and counts unpriced calls without profit', () => {
    const ranked = rankCallers([
      call({
        authorAddress: '0xc',
        parentId: 'x',
        priceAtPost: 1,
        tokenPriceUsd: 9,
        positionUsd: 9,
      }),
      call({
        authorAddress: '0xc',
        callType: 'comment',
        priceAtPost: 1,
        tokenPriceUsd: 9,
        positionUsd: 9,
      }),
      call({ authorAddress: '0xd' }),
    ]);
    expect(ranked).toEqual([{ address: '0xd', calls: 1, profitUsd: 0, bestPct: 0 }]);
  });
});
