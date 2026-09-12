import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { DEFAULT_ETH_PRICE_USD } from '@proto/shared-types';

export interface CoinGeckoConfig {
  mode: 'static' | 'coingecko';
  apiKey?: string;
  cacheTtlMs?: number;
}

export class CoinGeckoPriceFeedAdapter implements PriceFeedPort {
  private readonly mode: 'static' | 'coingecko';
  private readonly apiKey?: string;
  private readonly cacheTtlMs: number;

  private cachedPrice: number | null = null;
  private lastFetchTime = 0;

  constructor(config?: Partial<CoinGeckoConfig>) {
    this.mode =
      config?.mode ?? (process.env.PRICE_FEED_MODE as 'static' | 'coingecko') ?? 'coingecko';
    this.apiKey = config?.apiKey ?? process.env.COINGECKO_API_KEY;
    this.cacheTtlMs = config?.cacheTtlMs ?? 60_000; // 60s cache TTL to respect rate limits
  }

  async getEthPriceUsd(): Promise<number> {
    if (this.mode === 'static') {
      return DEFAULT_ETH_PRICE_USD;
    }

    const now = Date.now();
    if (this.cachedPrice !== null && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedPrice;
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.apiKey) {
        // CoinGecko Pro vs Demo API key headers
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
      // If we have an existing cached price, use it even if expired
      if (this.cachedPrice !== null) {
        console.warn(
          `[CoinGeckoPriceFeed] Fetch failed, using expired cache: ${(err as Error).message}`,
        );
        return this.cachedPrice;
      }

      // Fail-closed or fallback to reference price with explicit warning
      console.warn(
        `[CoinGeckoPriceFeed] Failed to fetch live price, falling back to default: ${(err as Error).message}`,
      );
      return DEFAULT_ETH_PRICE_USD;
    }
  }
}
