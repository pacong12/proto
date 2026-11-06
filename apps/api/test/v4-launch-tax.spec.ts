import { describe, expect, it } from 'vitest';
import { zeroAddress, type PublicClient } from 'viem';
import { ARC_CHAIN, type NetworkConfig } from '@goton/shared-types';
import { ViemChainIndexerAdapter } from '../src/modules/tokens/infrastructure/adapters/viem-chain-indexer.adapter';

const TOKEN = '0x00000000000000000000000000000000000000a1';
const CREATOR = '0x00000000000000000000000000000000000000c1';
const POOL_ID = `0x${'ab'.repeat(32)}` as const;
const HOOK = '0x00000000000000000000000000000000000000b1';

/** A chain where the hook holds `tax` for the pool. Pass null if the hook read should fail. */
function indexerOnChain(tax: [number, number] | null) {
  const hookReads: unknown[] = [];
  const client = {
    readContract: async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      if (functionName === 'pools') {
        hookReads.push(args);
        if (!tax) throw new Error('rpc down');
        return [zeroAddress, zeroAddress, zeroAddress, tax[0], tax[1]];
      }
      return { name: 'N', symbol: 'S', decimals: 18, totalSupply: 1n }[functionName] ?? '';
    },
  } as unknown as PublicClient;
  const indexer = new ViemChainIndexerAdapter();
  indexer.getClient = () => client;
  return { indexer, hookReads };
}

function network(memeHook: `0x${string}` | undefined): NetworkConfig {
  return { ...ARC_CHAIN, contracts: { ...ARC_CHAIN.contracts, memeHook } };
}

const fetchToken = (indexer: ViemChainIndexerAdapter, config: NetworkConfig) =>
  indexer.fetchV4LaunchedToken(TOKEN, POOL_ID, CREATOR, 0n, config);

describe('fetchV4LaunchedToken tax', () => {
  it('lists the token with the tax its hook holds', async () => {
    const { indexer, hookReads } = indexerOnChain([100, 0]);

    const token = await fetchToken(indexer, network(HOOK));

    expect(token.taxConfig).toEqual({ buyTaxBps: 100, sellTaxBps: 0, taxRecipient: CREATOR });
    expect(hookReads).toEqual([[POOL_ID]]);
  });

  it('leaves a tax-free token without a tax config', async () => {
    const { indexer } = indexerOnChain([0, 0]);

    expect((await fetchToken(indexer, network(HOOK))).taxConfig).toBeUndefined();
  });

  it('throws when the hook cannot be read, so the poller retries instead of listing 0%', async () => {
    const { indexer } = indexerOnChain(null);

    await expect(fetchToken(indexer, network(HOOK))).rejects.toThrow('rpc down');
  });

  it('skips the hook on a network without one', async () => {
    const { indexer, hookReads } = indexerOnChain([100, 100]);

    const token = await fetchToken(indexer, network(zeroAddress));

    expect(token.taxConfig).toBeUndefined();
    expect(hookReads).toEqual([]);
  });
});
