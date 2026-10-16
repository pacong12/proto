import { defineChain, fallback, http, type Chain, type Transport } from 'viem';
import type { NetworkConfig } from '@proto/shared-types';

/** The configured RPC endpoints for a network, primary first and without duplicates. */
export function rpcUrlsFor(cfg: NetworkConfig): string[] {
  return [...new Set([cfg.rpcUrl, ...(cfg.rpcUrls ?? [])].filter(Boolean))];
}

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

export function chainFor(cfg: NetworkConfig): Chain {
  return defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: { default: { http: rpcUrlsFor(cfg) } },
  });
}
