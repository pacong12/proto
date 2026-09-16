import { PriceFeedPort } from '../../domain/ports/price-feed.port';

export interface CoinGeckoConfig {
  apiKey?: string;
  cacheTtlMs?: number;
}

export class CoinGeckoPriceFeedAdapter implements PriceFeedPort {
  private readonly apiKey?: string;
  private readonly cacheTtlMs: number;

  private cachedPrice: number | null = null;
  private lastFetchTime = 0;

  constructor(config?: Partial<CoinGeckoConfig>) {
    this.apiKey = config?.apiKey ?? process.env.COINGECKO_API_KEY;
    this.cacheTtlMs = config?.cacheTtlMs ?? 60_000; // 60s cache TTL to respect rate limits
  }

  async getEthPriceUsd(): Promise<number> {
    const now = Date.now();
    if (this.cachedPrice !== null && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedPrice;
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.apiKey) {
        if (this.apiKey.startsWith('CG-')) {
          headers['x-cg-demo-api-key'] = this.apiKey;
        } else {
          headers['x-cg-pro-api-key'] = this.apiKey;
        }
      }

      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { headers },
      );

      if (!res.ok) {
        throw new Error(`CoinGecko HTTP error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as { ethereum?: { usd?: number } };
      const price = data.ethereum?.usd;

      if (typeof price === 'number' && price > 0) {
        this.cachedPrice = price;
        this.lastFetchTime = now;
        return price;
      }

      throw new Error('CoinGecko returned invalid price data');
    } catch (err) {
      // If we already have a live price cached from a previous successful fetch, reuse it
      if (this.cachedPrice !== null) {
        console.warn(
          `[CoinGeckoPriceFeed] Primary fetch failed, using cached live price: ${(err as Error).message}`,
        );
        return this.cachedPrice;
      }

      // Secondary live public ticker attempt (Coinbase spot)
      try {
        const cbRes = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
          headers: { Accept: 'application/json' },
        });
        if (cbRes.ok) {
          const cbData = (await cbRes.json()) as { data?: { amount?: string } };
          const cbPrice = parseFloat(cbData?.data?.amount || '');
          if (!isNaN(cbPrice) && cbPrice > 0) {
            this.cachedPrice = cbPrice;
            this.lastFetchTime = now;
            return cbPrice;
          }
        }
      } catch (cbErr) {
        console.warn(`[CoinGeckoPriceFeed] Secondary feed failed: ${(cbErr as Error).message}`);
      }

      throw new Error(
        `Failed to retrieve live ETH price from live feeds: ${(err as Error).message}`,
      );
    }
  }
}
