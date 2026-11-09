import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type PublicClient } from 'viem';
import { ROBINHOOD_CHAIN, type LaunchedTokenEntity } from '@goton/shared-types';
import { TradeSyncService } from '../src/modules/indexer/infrastructure/trade-sync.service';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { InMemoryCacheAdapter } from '../src/modules/observability/infrastructure/in-memory-cache.adapter';
import type { ChainRegistryPort } from '../src/modules/chains';
import type { LoggerPort } from '../src/core/ports/logger.port';

const TRADE = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);
const CURVE = '0x00000000000000000000000000000000000000c0' as const;
const TRADER = '0x00000000000000000000000000000000000000ee' as const;
const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const TX = `0x${'ab'.repeat(32)}` as const;

const token = {
  address: TOKEN,
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

const silent: LoggerPort = { debug() {}, info() {}, warn() {}, error() {} };

/** Reserves: 1 ETH / 1e9 tokens at the trade's block 100, ten times dearer at the head. */
function setup() {
  const reads: Array<bigint | undefined> = [];
  const client = {
    getTransactionReceipt: async () => ({
      status: 'success',
      blockNumber: 100n,
      transactionHash: TX,
      logs: [
        {
          address: CURVE,
          logIndex: 0,
          topics: encodeEventTopics({ abi: [TRADE], args: { trader: TRADER, isBuy: true } }),
          data: encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
            [10n ** 16n, 10n ** 25n, 10n ** 14n],
          ),
        },
      ],
    }),
    readContract: async ({
      functionName,
      blockNumber,
    }: {
      functionName: string;
      blockNumber?: bigint;
    }) => {
      reads.push(blockNumber);
      const atTrade = blockNumber === 100n;
      return functionName === 'virtualEthReserve' ? (atTrade ? 1n : 10n) * 10n ** 18n : 10n ** 27n;
    },
    getBlock: async () => ({ timestamp: 1_700_000_000n }),
  } as unknown as PublicClient;
  const chain = { client, chainId: ROBINHOOD_CHAIN.chainId, getQuotePriceUsd: async () => 2000 };
  const registry = { resolveForToken: () => chain } as unknown as ChainRegistryPort;
  const repo = new SqliteTokenRepository(':memory:');
  const sync = new TradeSyncService(repo, new InMemoryCacheAdapter(), registry, new Map(), silent);
  return { repo, sync, reads };
}

describe('TradeSyncService.indexFromReceipt', () => {
  it('prices a trade at its own block, not at the head', async () => {
    const { repo, sync, reads } = setup();
    await repo.save(token);
    await sync.indexFromReceipt(TX, TOKEN);
    const [trade] = await repo.getTrades(TOKEN, 1);
    expect(reads.every((b) => b === 100n)).toBe(true);
    expect(trade.priceQuote).toBeCloseTo(1e-9, 15);
  });

  it('never rewrites a trade the poller already indexed', async () => {
    const { repo, sync, reads } = setup();
    await repo.save(token);
    await repo.saveTrade({
      id: `${TX}-0`,
      tokenAddress: TOKEN,
      poolAddress: CURVE,
      trader: TRADER,
      isBuy: true,
      tokenAmount: '10000000.0000',
      wethAmount: '0.010000',
      priceUsd: 0.000002,
      priceQuote: 1e-9,
      blockNumber: 100n,
      transactionHash: TX,
      timestamp: 1_700_000_000_000,
    });
    await sync.indexFromReceipt(TX, TOKEN);
    const [trade] = await repo.getTrades(TOKEN, 1);
    expect(trade.priceUsd).toBe(0.000002);
    expect(reads).toHaveLength(0);
  });
});
