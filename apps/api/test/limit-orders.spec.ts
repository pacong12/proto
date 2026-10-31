import { describe, expect, it, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import {
  ROBINHOOD_CHAIN,
  type LimitOrderEntity,
  type LaunchedTokenEntity,
} from '@goton/shared-types';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
import { LimitOrderKeeperService } from '../src/modules/tokens/infrastructure/keeper/limit-order-keeper.service';
import { EventPollerService } from '../src/modules/tokens/infrastructure/indexer/event-poller.service';

const CONTRACT = '0x00000000000000000000000000000000000000c0' as const;
const OLD_CONTRACT = '0x00000000000000000000000000000000000000c1' as const;
const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const CURVE = '0x00000000000000000000000000000000000000cc' as const;
const OWNER = '0x00000000000000000000000000000000000000ee' as const;
const NOW = 1_800_000_000_000;
const network = {
  ...ROBINHOOD_CHAIN,
  contracts: {
    ...ROBINHOOD_CHAIN.contracts,
    limitOrders: CONTRACT,
    memeHook: '0x00000000000000000000000000000000000020cc',
  },
} as typeof ROBINHOOD_CHAIN;

const order = (over: Partial<LimitOrderEntity> = {}): LimitOrderEntity => ({
  key: `${network.chainId}-1`,
  chainId: network.chainId,
  orderId: '1',
  owner: OWNER,
  token: TOKEN,
  isBuy: true,
  amount: '1000000000000000000',
  minOut: '5',
  slPriceX36: '0',
  slMinOut: '0',
  deadline: NOW / 1000 + 3600,
  status: 'open',
  createdTx: '0x1',
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const token = (over: Partial<LaunchedTokenEntity> = {}) =>
  ({
    address: TOKEN,
    name: 'T',
    symbol: 'T',
    decimals: 18,
    totalSupply: '1',
    logo: '',
    description: '',
    socials: {},
    deployer: OWNER,
    pairedToken: ROBINHOOD_CHAIN.contracts.weth,
    poolAddress: CURVE,
    curveAddress: CURVE,
    isToken0: false,
    poolFee: 10000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: 0,
    initialBuyAmount: '0',
    version: 'v2',
    isGraduated: false,
    ...over,
  }) as unknown as LaunchedTokenEntity;

function keeperWith(opts: { fillable: string[]; gas?: bigint; gasPrice?: bigint }) {
  const simulated: string[] = [];
  const targets: string[] = [];
  const writes: unknown[] = [];
  const publicClient = {
    simulateContract: vi.fn(
      async ({
        address,
        functionName,
        args,
      }: {
        address: string;
        functionName: string;
        args: unknown[];
      }) => {
        const tag = `${functionName}:${String(args[2] ?? '')}`;
        simulated.push(tag);
        targets.push(address);
        if (!opts.fillable.includes(tag)) throw new Error('InsufficientOutput()');
        return { request: { functionName, args } };
      },
    ),
    estimateContractGas: vi.fn(async () => opts.gas ?? 300_000n),
    getGasPrice: vi.fn(async () => opts.gasPrice ?? 20_000_000n),
    waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
  } as unknown as PublicClient;
  const walletClient = {
    getAddresses: async () => ['0x00000000000000000000000000000000000000kk'.replace('kk', '99')],
    writeContract: vi.fn(async (req: unknown) => {
      writes.push(req);
      return '0xhash';
    }),
  } as unknown as WalletClient;
  return { publicClient, walletClient, simulated, targets, writes };
}

describe('limit order repository', () => {
  it('stores, updates and filters orders', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.saveLimitOrder!(order());
    await repo.saveLimitOrder!(order({ key: `${network.chainId}-2`, orderId: '2', isBuy: false }));
    await repo.saveLimitOrder!(order()); // replay of the same event is ignored
    await repo.updateLimitOrder!(`${network.chainId}-1`, {
      status: 'filled',
      filledLeg: 'buy',
      amountOut: '9',
    });

    const open = await repo.listLimitOrders!({
      owner: OWNER.toUpperCase().replace('0X', '0x'),
      status: 'open',
    });
    expect(open.map((o) => o.orderId)).toEqual(['2']);
    const [filled] = await repo.listLimitOrders!({ token: TOKEN, status: 'filled' });
    expect(filled).toMatchObject({ orderId: '1', filledLeg: 'buy', amountOut: '9', isBuy: true });
  });
});

describe('LimitOrderKeeperService', () => {
  async function run(
    o: LimitOrderEntity,
    t: LaunchedTokenEntity,
    opts: Parameters<typeof keeperWith>[0],
    net: typeof network = network,
  ) {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.save(t);
    await repo.saveLimitOrder!(o);
    const k = keeperWith(opts);
    const results = await new LimitOrderKeeperService(
      k.publicClient,
      k.walletClient,
      repo,
      net,
      1n,
      () => NOW,
    ).runOnce();
    return { ...k, results };
  }

  it('fills a buy on the curve when the simulation passes', async () => {
    const { results, writes } = await run(order(), token(), { fillable: ['executeBuyOnCurve:'] });
    expect(results).toEqual([{ key: `${network.chainId}-1`, executed: true, txHash: '0xhash' }]);
    // Sent with 25% over the estimate (300k gas in this stub).
    expect(writes).toEqual([
      { functionName: 'executeBuyOnCurve', args: [1n, CURVE], gas: 375_000n },
    ]);
  });

  it('routes graduated tokens to their v4 pool', async () => {
    const { simulated } = await run(order(), token({ isGraduated: true }), { fillable: [] });
    expect(simulated).toEqual(['executeBuyOnPool:']);
  });

  it('tries the stop-loss leg before the take-profit leg', async () => {
    const sell = order({
      isBuy: false,
      minOut: '1000000000000000000',
      slPriceX36: '7',
      slMinOut: '500000000000000000',
    });
    const { simulated, writes } = await run(sell, token(), { fillable: ['executeSellOnCurve:0'] });
    expect(simulated).toEqual(['executeSellOnCurve:1', 'executeSellOnCurve:0']);
    expect(writes).toHaveLength(1);
  });

  it('sends nothing when the order is not fillable yet', async () => {
    const { results, writes } = await run(order(), token(), { fillable: [] });
    expect(results).toEqual([]);
    expect(writes).toHaveLength(0);
  });

  it('skips fills whose executor fee does not cover gas', async () => {
    const tiny = order({ amount: '1000000000' }); // fee 1e6 wei < 300k gas * 20 gwei-ish
    const { results, writes } = await run(tiny, token(), { fillable: ['executeBuyOnCurve:'] });
    expect(results[0]).toMatchObject({ executed: false, reason: 'Fee does not cover gas' });
    expect(writes).toHaveLength(0);
  });

  it('still fills the take-profit leg when the stop-loss fee does not cover gas', async () => {
    const sell = order({
      isBuy: false,
      minOut: '1000000000000000000', // fee 1e15 wei covers 300k gas at 0.02 gwei
      slPriceX36: '7',
      slMinOut: '1000', // fee rounds to 0
    });
    const { results, writes } = await run(sell, token(), {
      fillable: ['executeSellOnCurve:1', 'executeSellOnCurve:0'],
    });
    expect(writes).toEqual([
      { functionName: 'executeSellOnCurve', args: [1n, CURVE, 0], gas: 375_000n },
    ]);
    expect(results[0]).toMatchObject({ executed: true });
  });

  it('fills each order in the deployment that holds it', async () => {
    const withPrevious = {
      ...network,
      contracts: { ...network.contracts, limitOrdersPrevious: [OLD_CONTRACT] },
    } as typeof network;
    const fillable = { fillable: ['executeBuyOnCurve:'] };
    const inOld = await run(order({ contract: OLD_CONTRACT }), token(), fillable, withPrevious);
    expect(inOld.targets).toEqual([OLD_CONTRACT]);
    const inNew = await run(order({ contract: CONTRACT }), token(), fillable, withPrevious);
    expect(inNew.targets).toEqual([CONTRACT]);
    // Rows from before orders recorded their contract belong to the first deployment.
    const legacy = await run(order(), token(), fillable, withPrevious);
    expect(legacy.targets).toEqual([OLD_CONTRACT]);
  });

  it('leaves orders of a contract it does not know alone', async () => {
    const stranger = '0x00000000000000000000000000000000000000c9' as const;
    const { simulated } = await run(order({ contract: stranger }), token(), {
      fillable: ['executeBuyOnCurve:'],
    });
    expect(simulated).toHaveLength(0);
  });

  it('ignores expired orders', async () => {
    const { simulated } = await run(order({ deadline: NOW / 1000 - 1 }), token(), {
      fillable: ['executeBuyOnCurve:'],
    });
    expect(simulated).toHaveLength(0);
  });
});

describe('limit order indexing', () => {
  it('records created, filled and cancelled orders from contract events', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    const logs = [
      {
        eventName: 'OrderCreated',
        address: CONTRACT,
        blockNumber: 10n,
        transactionHash: '0xc1',
        args: {
          id: 1n,
          order: {
            owner: OWNER,
            token: TOKEN,
            isBuy: true,
            deadline: 99n,
            amount: 5n,
            minOut: 7n,
            slPriceX36: 0n,
            slMinOut: 0n,
          },
        },
      },
      {
        eventName: 'OrderCreated',
        address: CONTRACT,
        blockNumber: 10n,
        transactionHash: '0xc2',
        args: {
          id: 2n,
          order: {
            owner: OWNER,
            token: TOKEN,
            isBuy: false,
            deadline: 99n,
            amount: 3n,
            minOut: 1n,
            slPriceX36: 2n,
            slMinOut: 1n,
          },
        },
      },
      {
        eventName: 'OrderFilled',
        address: CONTRACT,
        blockNumber: 11n,
        transactionHash: '0xf1',
        args: { id: 1n, leg: 2, amountOut: 8n },
      },
      {
        eventName: 'OrderCancelled',
        address: CONTRACT,
        blockNumber: 12n,
        transactionHash: '0xx2',
        args: { id: 2n },
      },
    ];
    const client = {
      getLogs: vi.fn(async ({ events }: { events?: unknown }) => (events ? logs : [])),
      getBlock: vi.fn(async () => ({ timestamp: 1_800_000_000n })),
    } as unknown as PublicClient;
    const poller = new EventPollerService(
      client,
      repo,
      {} as never,
      {} as never,
      { getQuoteAssetPriceUsd: async () => 1 } as never,
      network,
    );
    await poller.indexRange(1n, 20n);

    const all = await repo.listLimitOrders!({ owner: OWNER });
    const byId = Object.fromEntries(all.map((o) => [o.orderId, o]));
    expect(byId['1']).toMatchObject({
      status: 'filled',
      filledLeg: 'buy',
      amountOut: '8',
      closedTx: '0xf1',
      createdAt: 1_800_000_000_000,
    });
    expect(byId['2']).toMatchObject({
      status: 'cancelled',
      isBuy: false,
      slPriceX36: '2',
      closedTx: '0xx2',
    });
  });
  it('keeps orders of two deployments apart and adopts rows indexed before contracts were kept', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    // A row indexed by an older API: no contract, the old key format.
    await repo.saveLimitOrder!(order({ key: `${network.chainId}-1`, orderId: '1' }));
    const withPrevious = {
      ...network,
      contracts: { ...network.contracts, limitOrdersPrevious: [OLD_CONTRACT] },
    } as typeof network;
    const created = (address: string, id: bigint, tx: string) => ({
      eventName: 'OrderCreated',
      address,
      blockNumber: 10n,
      transactionHash: tx,
      args: {
        id,
        order: {
          owner: OWNER,
          token: TOKEN,
          isBuy: true,
          deadline: 99n,
          amount: 5n,
          minOut: 7n,
          slPriceX36: 0n,
          slMinOut: 0n,
        },
      },
    });
    // Order 1 again in the new deployment, then the old deployment's order 1 fills.
    const logs = [
      created(CONTRACT, 1n, '0xnew1'),
      {
        eventName: 'OrderFilled',
        address: OLD_CONTRACT,
        blockNumber: 11n,
        transactionHash: '0xf1',
        args: { id: 1n, leg: 2, amountOut: 8n },
      },
    ];
    const client = {
      getLogs: vi.fn(async ({ events }: { events?: unknown }) => (events ? logs : [])),
      getBlock: vi.fn(async () => ({ timestamp: 1_800_000_000n })),
    } as unknown as PublicClient;
    const poller = new EventPollerService(
      client,
      repo,
      {} as never,
      {} as never,
      { getQuoteAssetPriceUsd: async () => 1 } as never,
      withPrevious,
    );
    await poller.indexRange(1n, 20n);

    expect(
      vi.mocked(client.getLogs).mock.calls.some(([a]) => {
        const address = (a as { address?: unknown }).address;
        return Array.isArray(address) && address.length === 2;
      }),
    ).toBe(true);
    const all = await repo.listLimitOrders!({ owner: OWNER });
    const byContract = Object.fromEntries(all.map((o) => [o.contract, o]));
    expect(all).toHaveLength(2);
    expect(byContract[OLD_CONTRACT]).toMatchObject({
      key: `${network.chainId}-${OLD_CONTRACT}-1`,
      status: 'filled',
      closedTx: '0xf1',
    });
    expect(byContract[CONTRACT]).toMatchObject({
      key: `${network.chainId}-${CONTRACT}-1`,
      status: 'open',
      createdTx: '0xnew1',
    });
  });
});
