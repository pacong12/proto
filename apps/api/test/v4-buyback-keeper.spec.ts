import { describe, it, expect } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import {
  ARC_CHAIN,
  ROBINHOOD_CHAIN,
  UNDEPLOYED,
  type LaunchedTokenEntity,
} from '@goton/shared-types';
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
  /** Accrued protocol / liquidity shares; omitted = splitter from before the pull model. */
  protocolAccrued?: bigint;
  liquidityAccrued?: bigint;
  releaseReverts?: boolean;
  /** Quote-side LP fees collectFees would collect (default 0). */
  lpFees?: bigint;
}) {
  const simulated: Array<{ address: string; functionName: string }> = [];
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
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'protocolAccrued' || functionName === 'liquidityAccrued') {
        const value = opts[functionName];
        if (value === undefined) throw new Error('function selector was not recognized');
        return value;
      }
      return reads[functionName];
    },
    simulateContract: async ({
      address,
      functionName,
    }: {
      address: string;
      functionName: string;
    }) => {
      simulated.push({ address, functionName });
      if (functionName === 'collectFees') {
        return { result: [opts.lpFees ?? 0n, 0n], request: { functionName: 'collectFees' } };
      }
      if (functionName === 'buyback') {
        return { result: [opts.simulatedSpent, 1n], request: { functionName: 'buyback' } };
      }
      if (opts.releaseReverts) throw new Error('TransferFailed()\nmore detail');
      return { result: opts.protocolAccrued, request: { functionName } };
    },
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
  return { publicClient, walletClient, writes, sent, simulated };
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

  it('pays accrued protocol and liquidity shares to their vaults', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes } = setup({
      accrued: 0n,
      simulatedSpent: 0n,
      protocolAccrued: 3_000_000n,
      liquidityAccrued: 700_000n,
    });
    const results = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    expect(results.filter((r) => r.executed).map((r) => r.action)).toEqual([
      'releaseProtocolFees',
      'releaseLiquidityFees',
    ]);
    expect(writes).toEqual([
      { functionName: 'releaseProtocolFees' },
      { functionName: 'releaseLiquidityFees' },
    ]);
  });

  it('skips empty shares and splitters from before the pull model', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const empty = setup({
      accrued: 0n,
      simulatedSpent: 0n,
      protocolAccrued: 0n,
      liquidityAccrued: 0n,
    });
    await new V4BuybackKeeperService(
      empty.publicClient,
      empty.walletClient,
      repo,
      network,
    ).runOnce();
    expect(empty.writes).toHaveLength(0);

    const legacy = setup({ accrued: 0n, simulatedSpent: 0n });
    const results = await new V4BuybackKeeperService(
      legacy.publicClient,
      legacy.walletClient,
      repo,
      network,
    ).runOnce();
    expect(legacy.writes).toHaveLength(0);
    expect(results.every((r) => r.action === undefined)).toBe(true);
  });

  it('reports a rejected payout without sending a transaction', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes } = setup({
      accrued: 0n,
      simulatedSpent: 0n,
      protocolAccrued: 3_000_000n,
      releaseReverts: true,
    });
    const results = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
    ).runOnce();
    const release = results.find((r) => r.action === 'releaseProtocolFees');
    expect(release).toMatchObject({ executed: false, reason: 'TransferFailed()' });
    expect(writes).toHaveLength(0);
  });

  it('releases fees even on chains without a buyback contract', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes } = setup({
      accrued: 5_000_000n,
      simulatedSpent: 5_000_000n,
      protocolAccrued: 1_000_000n,
    });
    const noBuyback = {
      ...network,
      contracts: { ...network.contracts, buyback: '0x0000000000000000000000000000000000000000' },
    } as typeof network;
    await new V4BuybackKeeperService(publicClient, walletClient, repo, noBuyback).runOnce();
    expect(writes).toEqual([{ functionName: 'releaseProtocolFees' }]);
  });

  it('collects LP fees into the splitter before buying back', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes, simulated } = setup({
      accrued: 5_000_000n,
      simulatedSpent: 5_000_000n,
      lpFees: 2_000_000n,
    });
    const results = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
      1_000_000n,
    ).runOnce();
    expect(results.map((r) => [r.action ?? 'buyback', r.executed])).toEqual([
      ['collectFees', true],
      ['buyback', true],
    ]);
    expect(writes[0]).toEqual({ functionName: 'collectFees' });
    // On Arc the factory holds the locked positions of in-pool launches.
    expect(simulated[0]).toEqual({
      address: network.contracts.factoryV2,
      functionName: 'collectFees',
    });
  });

  it('leaves LP fees that are not worth a transaction', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token());
    const { publicClient, walletClient, writes } = setup({
      accrued: 0n,
      simulatedSpent: 0n,
      lpFees: 500_000n,
    });
    const results = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      network,
      1_000_000n,
    ).runOnce();
    expect(results.some((r) => r.action === 'collectFees')).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('collects through the graduator on chains whose tokens graduate from a curve', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save({
      ...token(),
      version: 'v2',
      isGraduated: true,
      chainId: ROBINHOOD_CHAIN.chainId,
    });
    const robinhood = {
      ...ROBINHOOD_CHAIN,
      contracts: {
        ...ROBINHOOD_CHAIN.contracts,
        graduator: '0x00000000000000000000000000000000000000c7',
        buyback: UNDEPLOYED,
      },
    } as typeof ROBINHOOD_CHAIN;
    const { publicClient, walletClient, simulated } = setup({
      accrued: 0n,
      simulatedSpent: 0n,
      lpFees: 3n * 10n ** 15n,
    });
    const results = await new V4BuybackKeeperService(
      publicClient,
      walletClient,
      repo,
      robinhood,
    ).runOnce();
    expect(simulated[0]).toEqual({
      address: robinhood.contracts.graduator,
      functionName: 'collectFees',
    });
    expect(results[0]).toMatchObject({ action: 'collectFees', executed: true });
  });
});
