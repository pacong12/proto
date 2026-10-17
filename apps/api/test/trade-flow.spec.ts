import { describe, expect, it } from 'vitest';
import type { TradeEventEntity } from '@goton/shared-types';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';
import { InMemoryTokenRepository } from '../src/modules/tokens/infrastructure/adapters/in-memory-token.repository';

const TOKEN = '0x00000000000000000000000000000000000000aa' as const;
let n = 0;
const trade = (
  trader: string,
  isBuy: boolean,
  weth: string,
  timestamp: number,
): TradeEventEntity => ({
  id: `t${n++}`,
  tokenAddress: TOKEN,
  poolAddress: TOKEN,
  trader: trader as `0x${string}`,
  isBuy,
  tokenAmount: '1',
  wethAmount: weth,
  priceUsd: 1,
  blockNumber: 1n,
  transactionHash: '0x0',
  timestamp,
});

describe.each([
  ['sqlite', () => new SqliteTokenRepository(':memory:')],
  ['in-memory', () => new InMemoryTokenRepository()],
])('getTradeFlow (%s)', (_name, make) => {
  it('splits quote volume, trade counts and distinct traders by side within the window', async () => {
    const repo = make();
    const now = 10_000_000;
    for (const t of [
      trade('0xA', true, '0.30', now - 1_000),
      trade('0xa', true, '0.10', now - 2_000), // same trader, different case
      trade('0xB', true, '0.20', now - 3_000),
      trade('0xC', false, '0.40', now - 4_000),
      trade('0xD', false, '9.00', now - 7_200_000), // outside the 1h window
    ]) {
      await repo.saveTrade(t);
    }
    const flow = await repo.getTradeFlow!(TOKEN, now - 3_600_000);
    expect(flow.buys).toBe(3);
    expect(flow.sells).toBe(1);
    expect(flow.buyers).toBe(2);
    expect(flow.sellers).toBe(1);
    expect(flow.buyQuote).toBeCloseTo(0.6, 10);
    expect(flow.sellQuote).toBeCloseTo(0.4, 10);
  });
});
