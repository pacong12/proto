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
