import { defineChain, type Chain } from 'viem';
import type { NetworkConfig } from './types';

/** The configured RPC endpoints for a network, primary first and without duplicates. */
export function rpcUrlsFor(cfg: NetworkConfig): string[] {
  return [...new Set([cfg.rpcUrl, ...(cfg.rpcUrls ?? [])].filter(Boolean))];
}

/** The viem chain definition of a network, shared by the API, the scripts and the app. */
export function toViemChain(cfg: NetworkConfig): Chain {
  return defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: { default: { http: rpcUrlsFor(cfg) } },
    blockExplorers: { default: { name: cfg.blockExplorerName, url: cfg.blockExplorer } },
  });
}
