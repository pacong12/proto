import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type PublicClient } from 'viem';
import { ROBINHOOD_CHAIN, type LaunchedTokenEntity, type NetworkConfig } from '@goton/shared-types';
import { EventPollerService } from '../src/modules/tokens/infrastructure/indexer/event-poller.service';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';

const TRADE = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);
const CURVE = '0x00000000000000000000000000000000000000c0' as const;
const TRADER = '0x00000000000000000000000000000000000000ee' as const;

const token = {
  address: '0x00000000000000000000000000000000000000aa',
  name: 'T',
  symbol: 'T',
  decimals: 18,
  totalSupply: '1000000000000000000000000000',
  logo: '',
  description: '',
  socials: {},
  deployer: TRADER,
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
} as unknown as LaunchedTokenEntity;

function tradeLog(blockNumber: bigint, logIndex: number) {
  return {
    address: CURVE,
    blockNumber,
    logIndex,
    transactionHash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
    args: {
      trader: TRADER,
      isBuy: true,
      ethAmount: 10n ** 14n,
      tokenAmount: 10n ** 22n,
      feeEth: 10n ** 12n,
    },
    topics: encodeEventTopics({ abi: [TRADE], args: { trader: TRADER, isBuy: true } }),
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
      [10n ** 14n, 10n ** 22n, 10n ** 12n],
    ),
  };
}

function poller(
  client: Partial<PublicClient>,
  repo = new SqliteTokenRepository(':memory:'),
  network: NetworkConfig = ROBINHOOD_CHAIN,
) {
  const p = new EventPollerService(
    client as PublicClient,
    repo,
    {} as never,
    {} as never,
    { getQuoteAssetPriceUsd: async () => 2400 } as never,
    network,
  );
  return { p, repo };
}

describe('curve trade backfill', () => {
  it('finds trades the live poller passed before the token was known, in large chunks', async () => {
    const ranges: Array<[bigint, bigint]> = [];
    const { p, repo } = poller({
      getLogs: (async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        ranges.push([fromBlock, toBlock]);
        return fromBlock <= 250_000n && 250_000n <= toBlock ? [tradeLog(250_000n, 3)] : [];
      }) as never,
      getBlock: (async () => ({ timestamp: 1_792_074_238n })) as never,
    });
    await repo.save(token);

    expect(await p.backfillCurveTrades(token, 0n, 500_000n)).toBe(1);
    expect(ranges).toEqual([
      [0n, 199_999n],
      [200_000n, 399_999n],
      [400_000n, 500_000n],
    ]);
    const [trade] = await repo.getTrades(token.address, 10, 0);
    expect(trade).toMatchObject({
      isBuy: true,
      wethAmount: '0.000100',
      timestamp: 1_792_074_238_000,
    });

    // Running it again upserts the same trade.
    await p.backfillCurveTrades(token, 0n, 500_000n);
    expect(await repo.getTrades(token.address, 10, 0)).toHaveLength(1);
  });

  it("keeps each request within the chain's eth_getLogs limit", async () => {
    const ranges: Array<[bigint, bigint]> = [];
    const { p, repo } = poller(
      {
        getLogs: (async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
          ranges.push([fromBlock, toBlock]);
          return [];
        }) as never,
      },
      undefined,
      { ...ROBINHOOD_CHAIN, maxLogBlockRange: 10_000 },
    );
    await repo.save(token);
    await p.backfillCurveTrades(token, 0n, 25_000n);
    expect(ranges).toEqual([
      [0n, 9_999n],
      [10_000n, 19_999n],
      [20_000n, 25_000n],
    ]);
  });

  it('prices a curve trade at the spot after its block, not at its taxed token ratio', async () => {
    // An anti-snipe buy: 99% of the tokens went to the tax, so ethAmount / tokenAmount is 100x
    // the real price. The curve's reserves at that block give the real one.
    const reads: Array<{ functionName: string; blockNumber?: bigint }> = [];
    const { p, repo } = poller({
      getLogs: (async () => [tradeLog(42n, 0)]) as never,
      getBlock: (async () => ({ timestamp: 1_792_074_238n })) as never,
      readContract: (async (args: { functionName: string; blockNumber?: bigint }) => {
        reads.push(args);
        return args.functionName === 'virtualEthReserve' ? 2n * 10n ** 18n : 10n ** 27n;
      }) as never,
    });
    await repo.save(token);
    await p.backfillCurveTrades(token, 0n, 100n);
    const [trade] = await repo.getTrades(token.address, 10, 0);
    expect(trade.priceUsd).toBeCloseTo((2 / 1e9) * 2400, 12); // spot 2e-9 ETH per token
    expect(reads.every((r) => r.blockNumber === 42n)).toBe(true);
  });

  it('falls back to the trade ratio when the block is older than the RPC state history', async () => {
    const { p, repo } = poller({
      getLogs: (async () => [tradeLog(42n, 0)]) as never,
      getBlock: (async () => ({ timestamp: 1_792_074_238n })) as never,
      readContract: (async () => {
        throw new Error('historical state not available');
      }) as never,
    });
    await repo.save(token);
    await p.backfillCurveTrades(token, 0n, 100n);
    const [trade] = await repo.getTrades(token.address, 10, 0);
    expect(trade.priceUsd).toBeCloseTo((1e-4 / 1e4) * 2400, 12); // 0.0001 ETH for 10,000 tokens
  });

  it('keeps the cursor when a trade poll fails, so the range is retried', async () => {
    let fail = true;
    const repo = new SqliteTokenRepository(':memory:');
    await repo.save(token);
    const { p } = poller(
      {
        getBlockNumber: (async () => 1_000n) as never,
        getLogs: (async () => {
          if (fail) throw new Error('RPC 503');
          return [];
        }) as never,
      },
      repo,
    );
    await p.pollEvents(900n, 949n);
    expect(await repo.getLastIndexedBlock?.(ROBINHOOD_CHAIN.name)).not.toBe(949n);
    fail = false;
    await p.pollEvents(900n, 949n);
    expect(await repo.getLastIndexedBlock?.(ROBINHOOD_CHAIN.name)).toBe(949n);
  });
});
