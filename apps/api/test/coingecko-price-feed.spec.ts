import { describe, it, expect, vi, afterEach } from 'vitest';
import { CoinGeckoPriceFeedAdapter } from '../src/modules/tokens/infrastructure/adapters/coingecko-price-feed.adapter';

describe('CoinGeckoPriceFeedAdapter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches live Ethereum USD price successfully from CoinGecko', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ethereum: { usd: 3450.5 } }),
    } as unknown as Response);

    const adapter = new CoinGeckoPriceFeedAdapter({
      mode: 'coingecko',
      apiKey: 'CG-dummy-demo-key',
    });

    const price = await adapter.getEthPriceUsd();
    expect(price).toBe(3450.5);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-cg-demo-api-key': 'CG-dummy-demo-key',
        }),
      }),
    );
  });

  it('serves cached price within TTL without triggering redundant HTTP calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ethereum: { usd: 3200 } }),
    } as unknown as Response);

    const adapter = new CoinGeckoPriceFeedAdapter({
      mode: 'coingecko',
      cacheTtlMs: 10_000,
    });

    const p1 = await adapter.getEthPriceUsd();
    const p2 = await adapter.getEthPriceUsd();

    expect(p1).toBe(3200);
    expect(p2).toBe(3200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to default price if network request fails and no cache exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Offline'));

    const adapter = new CoinGeckoPriceFeedAdapter({
      mode: 'coingecko',
    });

    const price = await adapter.getEthPriceUsd();
    expect(price).toBeGreaterThan(0);
  });

  it('returns default price directly when mode is static', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const adapter = new CoinGeckoPriceFeedAdapter({
      mode: 'static',
    });

    const price = await adapter.getEthPriceUsd();
    expect(price).toBe(2500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
