import { describe, expect, it } from 'vitest';
import type { PnlPosition } from '@goton/shared-types';
import { portfolioSummary } from '../src/composables/usePnlShare';

const pos = (over: Partial<PnlPosition['pnl']>): PnlPosition =>
  ({
    token: { address: '0x1', name: 'T', symbol: 'T', logo: '', chainId: 4663 },
    pnl: {
      investedUsd: 0,
      proceedsUsd: 0,
      realizedUsd: 0,
      unrealizedUsd: 0,
      totalUsd: 0,
      percent: null,
      holdingTokens: 0,
      avgEntryMarketCapUsd: null,
      avgExitMarketCapUsd: null,
      marketCapUsd: 0,
      buys: 1,
      sells: 0,
      firstTradeAt: 0,
      lastTradeAt: 0,
      status: 'holding',
      ...over,
    },
  }) as PnlPosition;

describe('portfolioSummary', () => {
  it('aggregates PnL, win rate and open-position count across positions', () => {
    const s = portfolioSummary([
      pos({ investedUsd: 100, realizedUsd: 0, unrealizedUsd: 50, totalUsd: 50, status: 'holding' }),
      pos({ investedUsd: 100, realizedUsd: 80, unrealizedUsd: 0, totalUsd: 80, status: 'sold' }),
      pos({ investedUsd: 100, realizedUsd: -40, unrealizedUsd: 0, totalUsd: -40, status: 'sold' }),
    ])!;
    expect(s.invested).toBe(300);
    expect(s.realized).toBe(40);
    expect(s.unrealized).toBe(50);
    expect(s.total).toBe(90);
    expect(s.percent).toBeCloseTo(30, 6);
    expect(s.count).toBe(3);
    expect(s.holding).toBe(1);
    expect(s.winRate).toBeCloseTo((2 / 3) * 100, 6); // two of three in profit
  });

  it('returns null with no positions', () => {
    expect(portfolioSummary([])).toBeNull();
  });
});
