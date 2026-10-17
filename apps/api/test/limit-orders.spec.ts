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
  const writes: unknown[] = [];
  const publicClient = {
    simulateContract: vi.fn(
      async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
        const tag = `${functionName}:${String(args[2] ?? '')}`;
        simulated.push(tag);
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
  return { publicClient, walletClient, simulated, writes };
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
  ) {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.save(t);
    await repo.saveLimitOrder!(o);
    const k = keeperWith(opts);
    const results = await new LimitOrderKeeperService(
      k.publicClient,
      k.walletClient,
      repo,
      network,
      1n,
      () => NOW,
    ).runOnce();
    return { ...k, results };
  }

  it('fills a buy on the curve when the simulation passes', async () => {
    const { results, writes } = await run(order(), token(), { fillable: ['executeBuyOnCurve:'] });
    expect(results).toEqual([{ key: `${network.chainId}-1`, executed: true, txHash: '0xhash' }]);
    expect(writes).toEqual([{ functionName: 'executeBuyOnCurve', args: [1n, CURVE] }]);
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
        blockNumber: 11n,
        transactionHash: '0xf1',
        args: { id: 1n, leg: 2, amountOut: 8n },
      },
      { eventName: 'OrderCancelled', blockNumber: 12n, transactionHash: '0xx2', args: { id: 2n } },
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
});
