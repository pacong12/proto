import { describe, it, expect } from 'vitest';
import type { PublicClient } from 'viem';
import {
  ARC_CHAIN,
  ROBINHOOD_CHAIN,
  type LaunchedTokenEntity,
  type NetworkConfig,
} from '@proto/shared-types';
import { EventPollerService } from '../src/modules/tokens/infrastructure/indexer/event-poller.service';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';
import type { ViemChainIndexerAdapter } from '../src/modules/tokens/infrastructure/adapters/viem-chain-indexer.adapter';
import type { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import type { PriceFeedPort } from '../src/modules/tokens/domain/ports/price-feed.port';

const IDEA = '0xd84ee1383e8e0f7a7bc8582e16d4a4942fd05f3a' as const;
const IDEA_POOL = '0x8c7d1c2f1b4eaa35ec3b0f636e94071a10cea7bbf6eda9fe3fe2adeb3769b412' as const;
const FACTORY = '0x00000000000000000000000000000000000000fa' as const;

function token(overrides: Partial<LaunchedTokenEntity>): LaunchedTokenEntity {
  return {
    address: IDEA,
    name: 'ideacoin',
    symbol: 'IDEA',
    decimals: 18,
    totalSupply: (10n ** 27n).toString(),
    logo: '',
    description: '',
    socials: {},
    deployer: '0x00000000000000000000000000000000000000c1',
    pairedToken: ARC_CHAIN.contracts.weth,
    poolAddress: IDEA_POOL,
    isToken0: false,
    poolFee: 10_000,
    positionId: 0n,
    restrictionsEndBlock: 0n,
    launchBlock: 0n,
    createdAt: 0,
    version: 'v4',
    ...overrides,
  };
}

/** Client stub that returns canned logs per event name. */
function stubClient(logsByEvent: Record<string, unknown[]>, quoteDecimals: number): PublicClient {
  return {
    getBlockNumber: async () => 10n,
    getLogs: async ({ event }: { event: { name: string } }) => logsByEvent[event.name] ?? [],
    readContract: async () => quoteDecimals,
    getBlock: async () => ({ timestamp: 1_700_000_000n }),
  } as unknown as PublicClient;
}

function poller(
  network: NetworkConfig,
  client: PublicClient,
  repo: InMemoryTokenRepository,
  indexer = {},
) {
  const priceFeed = {
    getQuoteAssetPriceUsd: async () => 1,
    getEthPriceUsd: async () => 1,
  } as unknown as PriceFeedPort;
  return new EventPollerService(
    client,
    repo,
    indexer as ViemChainIndexerAdapter,
    {} as CalculatePricingUseCase,
    priceFeed,
    { ...network, contracts: { ...network.contracts, factory: FACTORY, factoryV2: FACTORY } },
  );
}

describe('EventPollerService — Uniswap v4', () => {
  it('records a live Arc buy (USDC paid in, tokens out) as a buy', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token({}));
    // $IDEA launch prebuy (tx 0x472cb175…): swapper paid 1,300 USDC (amount0 < 0), received tokens.
    const swap = {
      args: {
        id: IDEA_POOL,
        sender: '0xb021be536808f551b31789422fd28a6c9c6e97da',
        amount0: -1_300_000_000n,
        amount1: 204_857_030_208_066_865_646_690_373n,
      },
      blockNumber: 25_977_118n,
      transactionHash: '0x472cb1757730ed09401d9177ca70222d7d04c74afe0ff7c218d61f2b7c9dd997',
      logIndex: 3,
    };
    await poller(ARC_CHAIN, stubClient({ Swap: [swap] }, 6), repo).pollEvents(1n, 1n);

    const [trade] = await repo.getRecentTrades(10);
    expect(trade.isBuy).toBe(true);
    expect(trade.wethAmount).toBe('1300.000000');
    expect(trade.tokenAmount).toBe('204857030.2081');
  });

  it('handles pools where the token sorts before the quote', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token({ isToken0: true }));
    // Sell: token paid in (amount0 < 0), quote received (amount1 > 0).
    const swap = {
      args: { id: IDEA_POOL, amount0: -(10n ** 24n), amount1: 5_000_000n },
      blockNumber: 1n,
      transactionHash: '0x01',
      logIndex: 0,
    };
    await poller(ARC_CHAIN, stubClient({ Swap: [swap] }, 6), repo).pollEvents(1n, 1n);
    const [trade] = await repo.getRecentTrades(10);
    expect(trade.isBuy).toBe(false);
    expect(trade.wethAmount).toBe('5.000000');
  });

  it('points a graduated curve token at its v4 pool', async () => {
    const repo = new InMemoryTokenRepository();
    const curve = '0x00000000000000000000000000000000000000cc' as const;
    await repo.save(
      token({
        version: 'v2',
        poolAddress: curve,
        curveAddress: curve,
        pairedToken: ROBINHOOD_CHAIN.contracts.weth,
      }),
    );
    const graduated = {
      args: { token: IDEA, poolId: IDEA_POOL, splitter: '0x01' },
      blockNumber: 1n,
    };
    await poller(ROBINHOOD_CHAIN, stubClient({ TokenGraduated: [graduated] }, 18), repo).pollEvents(
      1n,
      1n,
    );

    const saved = await repo.findByAddress(IDEA);
    expect(saved?.poolAddress).toBe(IDEA_POOL);
    expect(saved?.isGraduated).toBe(true);
    expect(saved?.curveAddress).toBe(curve);
  });

  it('indexes in-pool v4 launches', async () => {
    const repo = new InMemoryTokenRepository();
    const launched = {
      args: {
        token: IDEA,
        poolId: IDEA_POOL,
        creator: '0x00000000000000000000000000000000000000c1',
        prebuyUsdc6: 4_500_000n,
      },
      blockNumber: 1n,
    };
    const indexer = {
      fetchV4LaunchedToken: async (address: `0x${string}`, poolId: `0x${string}`) =>
        token({ address, poolAddress: poolId }),
    };
    await poller(
      ARC_CHAIN,
      stubClient({ TokenLaunchedV4: [launched] }, 6),
      repo,
      indexer,
    ).pollEvents(1n, 1n);
    expect((await repo.findByAddress(IDEA))?.version).toBe('v4');
  });
});
