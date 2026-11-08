import { describe, it, expect } from 'vitest';
import type { PublicClient } from 'viem';
import {
  ARC_CHAIN,
  ROBINHOOD_CHAIN,
  type LaunchedTokenEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import { EventPollerService } from '../src/modules/indexer/infrastructure/event-poller.service';
import { nextPollDelay } from '../src/app/poll-delay';
import { InMemoryTokenRepository } from '../src/app/storage/in-memory-token.repository';
import type { ViemChainIndexerAdapter } from '../src/modules/tokens/infrastructure/adapters/viem-chain-indexer.adapter';
import type { CalculatePricingUseCase } from '../src/modules/tokens/application/use-cases/calculate-pricing.use-case';
import type { PriceFeedPort } from '../src/core/ports/price-feed.port';

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
    getTransaction: async () => ({ from: '0x00000000000000000000000000000000000000e1' }),
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

  it('retries the range instead of storing the router when the signer cannot be read', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token({}));
    const ROUTER = '0xd8ec94f07f590f8ceb620a8d17bb555fbde366f1';
    const USER = '0x00000000000000000000000000000000000000f1';
    const swap = {
      args: { id: IDEA_POOL, sender: ROUTER, amount0: -1_000_000n, amount1: 10n ** 21n },
      blockNumber: 1n,
      transactionHash: '0x02',
      logIndex: 0,
    };
    let rateLimited = true;
    const client = {
      ...stubClient({ Swap: [swap] }, 6),
      getTransaction: async () => {
        if (rateLimited) throw new Error('rate limit exceeded');
        return { from: USER };
      },
    } as unknown as PublicClient;
    const events = poller(ARC_CHAIN, client, repo);
    await expect(events.indexRange(1n, 1n)).rejects.toThrow('rate limit exceeded');
    expect(await repo.getRecentTrades(10)).toHaveLength(0);

    rateLimited = false;
    await events.indexRange(1n, 1n);
    const [trade] = await repo.getRecentTrades(10);
    expect(trade.trader).toBe(USER);
  });

  it('records the transaction signer as the trader, not the router that called swap', async () => {
    const repo = new InMemoryTokenRepository();
    await repo.save(token({}));
    const ROUTER = '0xd8ec94f07f590f8ceb620a8d17bb555fbde366f1';
    const USER = '0x00000000000000000000000000000000000000f1';
    const swap = {
      args: { id: IDEA_POOL, sender: ROUTER, amount0: -1_000_000n, amount1: 10n ** 21n },
      blockNumber: 1n,
      transactionHash: '0x02',
      logIndex: 0,
    };
    const client = {
      ...stubClient({ Swap: [swap] }, 6),
      getTransaction: async () => ({ from: USER }),
    } as unknown as PublicClient;
    await poller(ARC_CHAIN, client, repo).pollEvents(1n, 1n);
    const [trade] = await repo.getRecentTrades(10);
    expect(trade.trader).toBe(USER);
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

describe('EventPollerService — failures do not lose blocks', () => {
  const launch = {
    args: { token: IDEA, poolId: IDEA_POOL, creator: '0x00000000000000000000000000000000000000c1' },
    blockNumber: 5n,
  };

  it('retries the range when a launched token cannot be read yet', async () => {
    const repo = new InMemoryTokenRepository();
    let reads = 0;
    const indexer = {
      fetchV4LaunchedToken: async () => {
        reads += 1;
        if (reads === 1) throw new Error('Request exceeds defined limit.');
        return token({});
      },
    };
    const p = poller(ARC_CHAIN, stubClient({ TokenLaunchedV4: [launch] }, 6), repo, indexer);
    await p.pollEvents();
    expect(await repo.findByAddress(IDEA)).toBeFalsy();
    await p.pollEvents();
    expect(await repo.findByAddress(IDEA)).toBeTruthy();
  });

  it('never skips a range because the RPC is rate limiting', async () => {
    const repo = new InMemoryTokenRepository();
    let limited = true;
    const client = {
      ...stubClient({ TokenLaunchedV4: [launch] }, 6),
      getLogs: async ({ event }: { event: { name: string } }) => {
        if (limited) throw new Error('Request exceeds defined limit.');
        return event.name === 'TokenLaunchedV4' ? [launch] : [];
      },
    } as unknown as PublicClient;
    const p = poller(ARC_CHAIN, client, repo, { fetchV4LaunchedToken: async () => token({}) });
    for (let i = 0; i < 12; i++) await p.pollEvents();
    limited = false;
    await p.pollEvents();
    expect(await repo.findByAddress(IDEA)).toBeTruthy();
  });

  it('reports a rate-limited cycle while catching up, so the scheduler backs off', async () => {
    let head = 10n;
    let limited = false;
    const client = {
      ...stubClient({}, 6),
      getBlockNumber: async () => head,
      getLogs: async () => {
        if (limited) throw new Error('Request exceeds defined limit.');
        return [];
      },
    } as unknown as PublicClient;
    const p = poller(ARC_CHAIN, client, new InMemoryTokenRepository());
    await p.pollEvents();
    head = 10_000n; // far behind: one cycle covers MAX_BLOCK_RANGE blocks
    await p.pollEvents();
    expect(p.isBehind).toBe(true);
    expect(p.lastPollFailed).toBe(false);
    const interval = { active: 3_000, idle: 10_000 };
    const delay = (previousMs: number) =>
      nextPollDelay({
        previousMs,
        interval,
        catchUpMs: 250,
        failed: p.lastPollFailed,
        behind: p.isBehind,
        found: 0,
      });
    expect(delay(250)).toBe(250);

    limited = true;
    expect(await p.pollEvents()).toBe(0);
    // isBehind still says behind; without the failure flag this retried every 250ms.
    expect(p.isBehind).toBe(true);
    expect(p.lastPollFailed).toBe(true);
    expect(delay(250)).toBe(3_000);
    expect(delay(3_000)).toBe(6_000);

    limited = false;
    await p.pollEvents();
    expect(p.lastPollFailed).toBe(false);
  });

  it('still skips a range that keeps failing for another reason', async () => {
    const repo = new InMemoryTokenRepository();
    const client = {
      ...stubClient({}, 6),
      getLogs: async () => {
        throw new Error('malformed log');
      },
    } as unknown as PublicClient;
    const stored: bigint[] = [];
    Object.assign(repo, {
      setLastIndexedBlock: async (_name: string, block: bigint) => {
        stored.push(block);
      },
    });
    const p = poller(ARC_CHAIN, client, repo);
    for (let i = 0; i < 6; i++) await p.pollEvents();
    expect(stored.length).toBeGreaterThan(0);
  });
});

describe('EventPollerService — catch-up', () => {
  it('indexes up to 2,000 blocks a cycle and reports when it is still behind', async () => {
    let head = 100_002n; // the poller stays 2 blocks behind the head
    const ranges: Array<[bigint, bigint]> = [];
    const client = {
      getBlockNumber: async () => head,
      getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        ranges.push([fromBlock, toBlock]);
        return [];
      },
      readContract: async () => 18,
      getBlock: async () => ({ timestamp: 1_700_000_000n }),
    } as unknown as PublicClient;
    let cursor = 90_000n;
    const repo = Object.assign(new InMemoryTokenRepository(), {
      getLastIndexedBlock: async () => cursor,
      setLastIndexedBlock: async (_: string, block: bigint) => {
        cursor = block;
      },
    });
    const p = poller(ROBINHOOD_CHAIN, client, repo);

    await p.pollEvents();
    expect(ranges[0]).toEqual([90_001n, 92_001n]);
    expect(cursor).toBe(92_001n);
    expect(p.isBehind).toBe(true);

    head = cursor + 500n;
    await p.pollEvents();
    expect(cursor).toBe(head - 2n);
    expect(p.isBehind).toBe(false);
  });
});

describe('EventPollerService — concurrent polls', () => {
  it('shares a poll already running instead of indexing the same range twice', async () => {
    let heads = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const client = {
      ...stubClient({}, 6),
      getBlockNumber: async () => {
        heads++;
        await gate;
        return 10n;
      },
    } as unknown as PublicClient;
    const p = poller(ARC_CHAIN, client, new InMemoryTokenRepository());
    const a = p.pollEvents();
    const b = p.pollEvents();
    expect(a).toBe(b);
    release();
    await Promise.all([a, b]);
    expect(heads).toBe(1);
    // The next poll after it starts a fresh one.
    await p.pollEvents();
    expect(heads).toBe(2);
  });
});
