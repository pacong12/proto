import { afterAll, describe, expect, it } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type PublicClient } from 'viem';
import { ROBINHOOD_CHAIN, limitOrderKey, type LaunchedTokenEntity } from '@goton/shared-types';
import { EventPollerService } from '../src/modules/indexer/infrastructure/event-poller.service';
import { LIMIT_ORDER_EVENTS } from '../src/modules/indexer/infrastructure/indexer-events';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';

const hex = (bytes: number) =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

const LIMIT_ORDERS = ROBINHOOD_CHAIN.contracts.limitOrders!;
const BUYBACK = ROBINHOOD_CHAIN.contracts.buyback!;
const ROUTER = ROBINHOOD_CHAIN.contracts.router!;
const KEEPER = hex(20);
const OWNER = hex(20);
const TOKEN = hex(20);
const CURVE = hex(20);
const POOL_ID = hex(32);
const network = {
  ...ROBINHOOD_CHAIN,
  contracts: { ...ROBINHOOD_CHAIN.contracts, poolManagerV4: hex(20) },
};

/** The OrderFilled a fill emits after its swap, as a receipt log. */
function orderFilled(id: bigint, logIndex: number) {
  const event = LIMIT_ORDER_EVENTS.find((e) => e.name === 'OrderFilled')!;
  return {
    address: LIMIT_ORDERS,
    logIndex,
    topics: encodeEventTopics({ abi: [event], args: { id, executor: KEEPER } }),
    data: encodeAbiParameters(
      [{ type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
      [0, 1n, 1n, 0n],
    ),
  };
}

async function setup() {
  const repository = new SqliteTokenRepository();
  await repository.save({
    address: TOKEN,
    name: 'T',
    symbol: 'T',
    decimals: 18,
    totalSupply: '1000000000000000000000000000',
    logo: '',
    description: '',
    socials: {},
    deployer: OWNER,
    pairedToken: ROBINHOOD_CHAIN.contracts.weth,
    poolAddress: POOL_ID,
    curveAddress: CURVE,
    isGraduated: true,
    isToken0: false,
    poolFee: 10000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 1n,
    createdAt: 1_793_000_000_000,
    initialBuyAmount: '0',
    version: 'v2',
  } as LaunchedTokenEntity);
  await repository.saveLimitOrder!({
    key: limitOrderKey(network.chainId, LIMIT_ORDERS, 7n),
    chainId: network.chainId,
    contract: LIMIT_ORDERS,
    orderId: '7',
    owner: OWNER,
    token: TOKEN,
    isBuy: true,
    amount: '1',
    minOut: '1',
    slPriceX36: '0',
    slMinOut: '0',
    deadline: 2_000_000_000,
    status: 'open',
    createdTx: hex(32),
    createdAt: 1,
    updatedAt: 1,
  });
  return repository;
}

const poller = (client: object, repository: SqliteTokenRepository) =>
  new EventPollerService(
    client as PublicClient,
    repository,
    {} as never,
    {} as never,
    { getQuoteAssetPriceUsd: async () => 3000 } as never,
    network,
  );

const buy = (sender: string, tx: `0x${string}`) => ({
  args: { id: POOL_ID, sender, amount0: -(10n ** 17n), amount1: 10n ** 24n },
  blockNumber: 500n,
  logIndex: 3,
  transactionHash: tx,
});

describe('trades made by protocol contracts', () => {
  const repos: SqliteTokenRepository[] = [];
  afterAll(() => repos.forEach((r) => r.close()));

  it("credits a keeper's limit-order fill in the pool to the order's owner", async () => {
    const repository = await setup();
    repos.push(repository);
    const tx = hex(32);
    const client = {
      getLogs: async () => [buy(ROUTER, tx)],
      getBlock: async () => ({ timestamp: 1_793_100_000n }),
      // The keeper signs the fill and sends it to the order contract, which swaps via the router.
      getTransaction: async () => ({ from: KEEPER, to: LIMIT_ORDERS }),
      getTransactionReceipt: async () => ({ logs: [orderFilled(7n, 5)] }),
      readContract: async () => 18,
    };
    await poller(client, repository).trades.pollV4Swaps(500n, 500n);
    const [trade] = await repository.getTrades(TOKEN, 10, 0);
    expect(trade.trader.toLowerCase()).toBe(OWNER.toLowerCase());
  });

  it('credits a buyback swap to the buyback contract, not the keeper that signed it', async () => {
    const repository = await setup();
    repos.push(repository);
    const client = {
      getLogs: async () => [buy(BUYBACK, hex(32))],
      getBlock: async () => ({ timestamp: 1_793_100_000n }),
      getTransaction: async () => ({ from: KEEPER, to: BUYBACK }),
      readContract: async () => 18,
    };
    await poller(client, repository).trades.pollV4Swaps(500n, 500n);
    const [trade] = await repository.getTrades(TOKEN, 10, 0);
    expect(trade.trader.toLowerCase()).toBe(BUYBACK.toLowerCase());
  });

  it("keeps a user's own router swap on the wallet that sent it", async () => {
    const repository = await setup();
    repos.push(repository);
    const client = {
      getLogs: async () => [buy(ROUTER, hex(32))],
      getBlock: async () => ({ timestamp: 1_793_100_000n }),
      getTransaction: async () => ({ from: OWNER, to: ROUTER }),
      getTransactionReceipt: async () => {
        throw new Error('a plain swap needs no receipt');
      },
      readContract: async () => 18,
    };
    await poller(client, repository).trades.pollV4Swaps(500n, 500n);
    const [trade] = await repository.getTrades(TOKEN, 10, 0);
    expect(trade.trader.toLowerCase()).toBe(OWNER.toLowerCase());
  });
});
