import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type Hex } from 'viem';
import type { LaunchedTokenEntity, TradeEventEntity } from '@goton/shared-types';
import { TradeSyncService } from '../src/modules/indexer/infrastructure/trade-sync.service';

const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
const CURVE = '0x00000000000000000000000000000000000000c0' as const;
const FORGER = '0x00000000000000000000000000000000000000f0' as const;
const TRADER = '0x000000000000000000000000000000000000bEEF' as const;
const TX = `0x${'ab'.repeat(32)}` as Hex;
const TRADE = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);

const tradeLog = (address: string, logIndex: number) => ({
  address,
  logIndex,
  topics: encodeEventTopics({ abi: [TRADE], args: { trader: TRADER, isBuy: true } }),
  data: encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    [10n ** 21n, 10n ** 18n, 0n],
  ),
});

function setup(logs: ReturnType<typeof tradeLog>[]) {
  const saved: TradeEventEntity[] = [];
  const token = {
    address: TOKEN,
    curveAddress: CURVE,
    poolAddress: CURVE,
    version: 'v2',
    decimals: 18,
  } as unknown as LaunchedTokenEntity;
  const client = {
    getTransactionReceipt: async () => ({
      status: 'success',
      blockNumber: 1n,
      transactionHash: TX,
      logs,
    }),
    getBlock: async () => ({ timestamp: 1n }),
    readContract: async () => 1n,
  };
  const repository = {
    findByAddress: async () => token,
    saveTrade: async (t: TradeEventEntity) => void saved.push(t),
    getMarketData: async () => null,
    saveMarketData: async () => undefined,
  };
  const cache = { del: async () => undefined, delPrefix: async () => undefined };
  const registry = {
    resolveForToken: () => ({ client, getQuotePriceUsd: async () => 2000 }),
  };
  const sync = new TradeSyncService(
    repository as never,
    cache as never,
    registry as never,
    new Map(),
    { info() {}, warn() {}, error() {}, debug() {} } as never,
  );
  return { sync, saved };
}

describe('TradeSyncService.indexFromReceipt', () => {
  it("stores only the Trade events of the token's own curve", async () => {
    const { sync, saved } = setup([tradeLog(FORGER, 0), tradeLog(CURVE, 1)]);
    await sync.indexFromReceipt(TX, TOKEN);
    expect(saved.map((t) => t.id)).toEqual([`${TX}-1`]);
  });

  it('ignores a receipt whose Trade events come from another contract', async () => {
    const { sync, saved } = setup([tradeLog(FORGER, 0)]);
    await sync.indexFromReceipt(TX, TOKEN);
    expect(saved).toEqual([]);
  });
});
