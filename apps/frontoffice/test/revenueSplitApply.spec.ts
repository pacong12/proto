import { describe, expect, it, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { ROBINHOOD_CHAIN } from '@goton/shared-types';

vi.mock('../src/lib/viem-client', () => ({
  waitForReceiptWithFallback: vi.fn(async () => ({ status: 'success' })),
}));

const { RobinhoodChainAdapter } = await import('../src/chains/robinhood/robinhood.adapter');

const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const ACCOUNT = '0x00000000000000000000000000000000000000cc' as const;
const SPLIT = { creator: 50, buyback: 0, holders: 50, growth: 0 };

function adapterWithGraduator(graduator: `0x${string}`) {
  const adapter = new RobinhoodChainAdapter();
  Object.defineProperty(adapter, 'network', {
    value: { ...ROBINHOOD_CHAIN, contracts: { ...ROBINHOOD_CHAIN.contracts, graduator } },
  });
  return adapter;
}

function wallet(write: () => Promise<`0x${string}`>) {
  const writeContract = vi.fn(write);
  return { client: { writeContract, chain: undefined } as unknown as WalletClient, writeContract };
}
const publicClient = {} as PublicClient;

describe('Robinhood revenue split', () => {
  it('reports success when the split transaction lands', async () => {
    const adapter = adapterWithGraduator('0x00000000000000000000000000000000000000dd');
    const { client, writeContract } = wallet(async () => '0xhash');
    await expect(
      adapter.applyRevenueSplit(TOKEN, SPLIT, client, publicClient, ACCOUNT),
    ).resolves.toBe(true);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'setRevenueSplit',
        args: [TOKEN, 5_000, 0, 5_000, 0],
      }),
    );
  });

  it('reports failure instead of hiding it (rejected signature or trading already started)', async () => {
    const adapter = adapterWithGraduator('0x00000000000000000000000000000000000000dd');
    const { client } = wallet(async () => {
      throw new Error('SplitLocked()');
    });
    await expect(
      adapter.applyRevenueSplit(TOKEN, SPLIT, client, publicClient, ACCOUNT),
    ).resolves.toBe(false);
  });

  it('reports failure when no graduator is deployed', async () => {
    const adapter = adapterWithGraduator('0x0000000000000000000000000000000000000000');
    const { client, writeContract } = wallet(async () => '0xhash');
    await expect(
      adapter.applyRevenueSplit(TOKEN, SPLIT, client, publicClient, ACCOUNT),
    ).resolves.toBe(false);
    expect(writeContract).not.toHaveBeenCalled();
  });
});
