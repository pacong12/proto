// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { ROBINHOOD_NETWORK, type NetworkConfig } from '@goton/shared-types';
import type { TradePage } from '../src/composables/trade/types';

const api = vi.hoisted(() => ({ ohlcv: [] as unknown[] }));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(async (path: string) =>
    path.includes('/ohlcv') ? { success: true, data: api.ohlcv } : { success: true, data: [] },
  ),
}));
vi.mock('@/lib/viem-client', () => ({ getPublicClient: () => ({ readContract: async () => 0n }) }));
vi.mock('@/chains', () => ({
  getChainAdapter: () => ({ readVestingVault: async () => null }),
}));
vi.mock('@/composables/useTokenStream', () => ({
  useTokenStream: () => ({ start: vi.fn(), stop: vi.fn(), connected: ref(false) }),
}));

const { useTradeMarket } = await import('../src/composables/trade/useTradeMarket');
const TOKEN = '0x00000000000000000000000000000000000000aa';

function market(network: NetworkConfig = ROBINHOOD_NETWORK) {
  const page = {
    activeBottomTab: ref('trades'),
    // A live price > 0 is what used to trigger the synthetic flat baseline.
    currentMarketData: ref({ priceUsd: 0.0001, priceInWeth: 1, marketCapUsd: 100000 }),
    currentToken: ref({ address: TOKEN, createdAt: Date.now() - 34 * 86_400_000, decimals: 18 }),
    tokenLoading: ref(false),
    tokenNetwork: ref(network),
  } as unknown as TradePage;
  return useTradeMarket(page);
}

describe('chart data for a token with no transactions', () => {
  it('leaves the chart empty (no synthetic baseline) when the token has no trades', async () => {
    api.ohlcv = [];
    const result = market();
    result.selectedResolution.value = 86_400;
    await result.fetchCandlesticks(TOKEN, 86_400, false);
    // The empty state ("No transactions found") renders from an empty series, not a flat line.
    expect(result.candlestickData.value).toEqual([]);
  });

  it('shows candles when the token has real trades', async () => {
    const t = Math.floor(Date.now() / 1000) - 3600;
    api.ohlcv = [{ timestamp: t, open: 1, high: 2, low: 1, close: 2, volume: 5 }];
    const result = market();
    result.selectedResolution.value = 86_400;
    await result.fetchCandlesticks(TOKEN, 86_400, false);
    expect(result.candlestickData.value.length).toBeGreaterThan(0);
  });
});
