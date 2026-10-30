import { afterAll, describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { ROBINHOOD_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { EventPollerService } from '../src/modules/tokens/infrastructure/indexer/event-poller.service';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';

const hex = (bytes: number) =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

const TOKEN = hex(20);
const CURVE = hex(20);
const POOL_ID = hex(32);
const ROUTER = hex(20);
const WALLET = hex(20);
const TX = hex(32);

describe('v4 swaps after graduation', () => {
  const repository = new SqliteTokenRepository();
  afterAll(() => repository.close());

  it('attributes PoolManager swaps to the token by poolId and to the wallet that sent them', async () => {
    // State after pollGraduations: the token's pool is its v4 poolId, ETH is currency0.
    await repository.save({
      address: TOKEN,
      name: 'Graduated',
      symbol: 'GRAD',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: '',
      description: '',
      socials: {},
      deployer: WALLET,
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

    const client = {
      // Buy: the swapper pays 0.5 ETH (currency0, negative) and receives 1,000,000 tokens.
      getLogs: async () => [
        {
          args: {
            id: POOL_ID,
            sender: ROUTER,
            amount0: -500_000_000_000_000_000n,
            amount1: 1_000_000_000_000_000_000_000_000n,
          },
          blockNumber: 500n,
          logIndex: 12,
          transactionHash: TX,
        },
      ],
      getBlock: async () => ({ timestamp: 1_793_100_000n }),
      getTransaction: async () => ({ from: WALLET }),
      readContract: async () => 18,
    } as unknown as PublicClient;
    const poller = new EventPollerService(
      client,
      repository,
      {} as never,
      {} as never,
      { getQuoteAssetPriceUsd: async () => 3000 } as never,
      { ...ROBINHOOD_CHAIN, contracts: { ...ROBINHOOD_CHAIN.contracts, poolManagerV4: hex(20) } },
    );

    const saved = await poller.trades.pollV4Swaps(500n, 500n);
    expect(saved).toBe(1);

    const [trade] = await repository.getTrades(TOKEN, 10, 0);
    expect(trade).toMatchObject({
      id: `${TX}-12`,
      poolAddress: POOL_ID,
      trader: WALLET,
      isBuy: true,
      tokenAmount: '1000000.0000',
      wethAmount: '0.500000',
      timestamp: 1_793_100_000_000,
    });
  });
});
