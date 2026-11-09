import { createPublicClient, fallback, http, type PublicClient, type Transport } from 'viem';
import { rpcUrlsFor, toViemChain, type NetworkConfig } from '@goton/shared-types';

/**
 * DR-02: fail over across every configured endpoint instead of binding to one URL.
 * Each endpoint retries once on transport errors (timeouts, 429, 5xx); contract reverts are
 * never retried by viem, so this does not multiply load on reverted calls.
 */
export function rpcTransport(cfg: NetworkConfig, timeout = 10_000): Transport {
  const urls = rpcUrlsFor(cfg);
  const endpoints = urls.map((url) => http(url, { timeout, retryCount: 1, retryDelay: 300 }));
  return endpoints.length === 1 ? endpoints[0]! : fallback(endpoints);
}

export function createChainClient(cfg: NetworkConfig): PublicClient {
  return createPublicClient({ chain: toViemChain(cfg), transport: rpcTransport(cfg) });
}

/**
 * An RPC refusing for load, not a failed call: HTTP 429 (viem's HttpRequestError carries it as
 * `status`, with no code and often no "too many requests" in its message), JSON-RPC -32005, or a
 * provider's "rate limit" / "exceeds defined limit" message, anywhere in the cause chain.
 */
export function isRateLimited(e: unknown): boolean {
  type Err = { cause?: unknown; status?: number; code?: number; message?: string };
  const seen = new Set<unknown>();
  for (let c = e as Err | undefined; c && !seen.has(c); c = c.cause as Err | undefined) {
    seen.add(c);
    if (
      c.status === 429 ||
      c.code === 429 ||
      c.code === -32005 ||
      /rate limit|too many requests|\b429\b|exceeds defined limit/i.test(c.message ?? '')
    ) {
      return true;
    }
  }
  return false;
}
