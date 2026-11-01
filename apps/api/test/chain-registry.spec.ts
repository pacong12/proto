import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { CHAINS, DEFAULT_NETWORK, ARC_CHAIN } from '@goton/shared-types';
import { ChainRegistry } from '../src/modules/chains';
import type { PriceFeedPort } from '../src/modules/tokens/domain/ports/price-feed.port';

const priceFeed = {
  getQuoteAssetPriceUsd: async (chainId: number) => (chainId === ARC_CHAIN.chainId ? 1 : 2500),
} as unknown as PriceFeedPort;

const registry = new ChainRegistry(
  priceFeed,
  (net) => ({ chainId: net.chainId }) as unknown as PublicClient,
);

describe('ChainRegistry', () => {
  it('serves one chain per registered network, each with its own client', () => {
    expect(registry.getAllChains().map((c) => c.network)).toEqual(CHAINS);
    for (const chain of registry.getAllChains()) {
      expect((chain.client as unknown as { chainId: number }).chainId).toBe(chain.chainId);
    }
  });

  it('resolves chains by ID, slug and token, and falls back to the default network', () => {
    expect(registry.getChainByParam('arc').network).toBe(ARC_CHAIN);
    expect(registry.getChainById(ARC_CHAIN.chainId).network).toBe(ARC_CHAIN);
    expect(registry.resolveForToken({ pairedToken: ARC_CHAIN.contracts.weth }).network).toBe(
      ARC_CHAIN,
    );
    expect(registry.getChainById(1).network).toBe(DEFAULT_NETWORK);
    expect(registry.getChainById().network).toBe(DEFAULT_NETWORK);
  });

  it('prices each chain in its own quote asset', async () => {
    expect(await registry.getChainById(ARC_CHAIN.chainId).getQuotePriceUsd()).toBe(1);
  });
});
