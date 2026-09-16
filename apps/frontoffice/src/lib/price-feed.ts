/**
 * Live price feed client for the frontoffice.
 * Queries CoinGecko API directly with in-memory caching to respect rate limits.
 */
let cachedEthPriceUsd: number | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export async function getLiveEthPriceUsd(): Promise<number> {
  const now = Date.now();
  if (cachedEthPriceUsd !== null && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return cachedEthPriceUsd;
  }

  // 1. CoinGecko API
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    );
    if (res.ok) {
      const data = (await res.json()) as { ethereum?: { usd?: number } };
      const price = data?.ethereum?.usd;
      if (typeof price === 'number' && price > 0) {
        cachedEthPriceUsd = price;
        lastFetchTimestamp = now;
        return price;
      }
    }
  } catch {
    // Non-blocking, fall through to backend API
  }

  // 2. Backend API proxy
  try {
    const res = await fetch('/api/price');
    if (res.ok) {
      const data = (await res.json()) as { success: boolean; data?: { ethPriceUsd?: number } };
      const price = data?.data?.ethPriceUsd;
      if (typeof price === 'number' && price > 0) {
        cachedEthPriceUsd = price;
        lastFetchTimestamp = now;
        return price;
      }
    }
  } catch {
    // Non-blocking
  }

  if (cachedEthPriceUsd !== null) {
    return cachedEthPriceUsd;
  }

  throw new Error('Gagal mengambil harga live ETH dari CoinGecko');
}
