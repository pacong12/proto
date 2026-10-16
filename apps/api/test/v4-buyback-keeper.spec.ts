import { describe, it, expect } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { ARC_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { V4BuybackKeeperService } from '../src/modules/tokens/infrastructure/keeper/v4-buyback-keeper.service';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';

const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const SPLITTER = '0x00000000000000000000000000000000000000bb' as const;
const network = {
  ...ARC_CHAIN,
  contracts: {
    ...ARC_CHAIN.contracts,
    factory: '0x00000000000000000000000000000000000000fa',
    factoryV2: '0x00000000000000000000000000000000000000fa',
    memeHook: '0x00000000000000000000000000000000000020cc',
    buyback: '0x00000000000000000000000000000000000000bb',
  },
} as typeof ARC_CHAIN;

function token(): LaunchedTokenEntity {
  return {
    address: TOKEN,
    name: 'T',
    symbol: 'T',
    decimals: 18,
    totalSupply: '1',
    logo: '',
    description: '',
    socials: {},
    deployer: TOKEN,
    pairedToken: ARC_CHAIN.contracts.weth,
    poolAddress: `0x${'1'.repeat(64)}`,
    isToken0: false,
    poolFee: 10_000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: 0,
    version: 'v4',
  };
}

function setup(opts: {
  accrued: bigint;
  simulatedSpent: bigint;
  nonces?: { latest: number; pending: number };
}) {
  const writes: unknown[] = [];
  const sent: Array<{ nonce: number; maxFeePerGas: bigint }> = [];
  const nonces = opts.nonces ?? { latest: 3, pending: 3 };
  const reads: Record<string, unknown> = {
    launches: [TOKEN, SPLITTER, TOKEN, `0x${'1'.repeat(64)}`, 0n, false],
    quoteAsset: ARC_CHAIN.contracts.weth,
    decimals: 6,
    buybackAccrued: opts.accrued,
    pending: 0n,
  };
  const publicClient = {
    readContract: async ({ functionName }: { functionName: string }) => reads[functionName],
    simulateContract: async () => ({
      result: [opts.simulatedSpent, 1n],
      request: { functionName: 'buyback' },
    }),
    getTransactionCount: async ({ blockTag }: { blockTag: 'latest' | 'pending' }) =>
      nonces[blockTag],
    waitForTransactionReceipt: async () => ({ status: 'success' }),
    estimateFeesPerGas: async () => ({ maxFeePerGas: 100n, maxPriorityFeePerGas: 10n }),
  } as unknown as PublicClient;
  const walletClient = {
    getAddresses: async () => ['0x00000000000000000000000000000000000000cc'],
    writeContract: async (req: unknown) => {
      writes.push(req);
      return '0xhash';
    },
    sendTransaction: async (tx: { nonce: number; maxFeePerGas: bigint }) => {
      sent.push(tx);
      return '0xcancel';
    },
  } as unknown as WalletClient;
  return { publicClient, walletClient, writes, sent };
}

describe('V4BuybackKeeperService', () => {
  it('buys back when a burn share is waiting and the guard allows it', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes } = setup({
      accrued: 5_000_000n,
      simulatedSpent: 5_000_000n,
    });
    const [result] = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    expect(result.executed).toBe(true);
    expect(writes).toHaveLength(1);
  });

  it('sends no transaction when the price is outside the TWAP guard', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes } = setup({
      accrued: 5_000_000n,
      simulatedSpent: 0n,
    });
    const [result] = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    expect(result.executed).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('skips tokens with nothing to buy back', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes } = setup({ accrued: 0n, simulatedSpent: 1n });
    const [result] = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    expect(result.reason).toBe('Nothing worth buying back');
    expect(writes).toHaveLength(0);
  });

  it('waits while an earlier keeper transaction is pending, then replaces it with higher fees', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes, sent } = setup({
      accrued: 5_000_000n,
      simulatedSpent: 5_000_000n,
      nonces: { latest: 7, pending: 8 },
    });
    let clock = 0;
    const keeper = new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
      0n,
      () => clock,
    );

    expect(await keeper.runOnce()).toEqual([]);
    clock = 60_000;
    expect(await keeper.runOnce()).toEqual([]);
    expect(sent).toHaveLength(0);

    clock = 6 * 60_000;
    expect(await keeper.runOnce()).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ nonce: 7, maxFeePerGas: 150n, value: 0n });
    expect(writes).toHaveLength(0);
  });
});
