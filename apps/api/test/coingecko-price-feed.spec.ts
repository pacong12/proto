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
      json: async () => ({ ethereum: { usd: 2365.35 } }),
    } as unknown as Response);

    const adapter = new CoinGeckoPriceFeedAdapter({
      apiKey: 'CG-test-key',
    });

    const price = await adapter.getEthPriceUsd();
    expect(price).toBe(2365.35);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-cg-demo-api-key': 'CG-test-key',
        }),
      }),
    );
  });

  it('serves cached price within TTL without triggering redundant HTTP calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ethereum: { usd: 2400 } }),
    } as unknown as Response);

    const adapter = new CoinGeckoPriceFeedAdapter({
      cacheTtlMs: 10_000,
    });

    const p1 = await adapter.getEthPriceUsd();
    const p2 = await adapter.getEthPriceUsd();

    expect(p1).toBe(2400);
    expect(p2).toBe(2400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws descriptive error when all live network requests fail and no cache exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Offline'));

    const adapter = new CoinGeckoPriceFeedAdapter();

    await expect(adapter.getEthPriceUsd()).rejects.toThrow(
      'Failed to retrieve live ETH price from live feeds',
    );
  });
});
