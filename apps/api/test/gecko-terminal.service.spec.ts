import { describe, expect, it } from 'vitest';
import type { LaunchedTokenEntity, TradeEventEntity } from '@goton/shared-types';
import { GeckoTerminalService } from '../src/modules/dex';
import type { IChainService } from '../src/modules/chains';
import type { GetTokenByAddressUseCase } from '../src/modules/tokens/application/use-cases/get-token-by-address.use-case';
import type { GetCandlesticksUseCase } from '../src/modules/trades/application/use-cases/get-candlesticks.use-case';
import { NotFoundError } from '../src/core/errors/app-error';

const POOL = '0x2000000000000000000000000000000000000002';
const token = {
  address: '0x1000000000000000000000000000000000000001',
  poolAddress: POOL,
} as unknown as LaunchedTokenEntity;
const now = Date.now();
const trade = (isBuy: boolean, wethAmount: string, ageMs: number) =>
  ({ isBuy, wethAmount, timestamp: now - ageMs }) as TradeEventEntity;
const trades = [
  trade(true, '1', 1000),
  trade(false, '2', 2000),
  trade(true, '4', 2 * 86_400_000), // older than 24h
];
const chain = { getQuotePriceUsd: async () => 2000 } as unknown as IChainService;

/** Stores without the optional lookups: the service must fall back to scans and sums. */
const service = (getTokenByAddress?: Partial<GetTokenByAddressUseCase>) =>
  new GeckoTerminalService(
    {
      findAll: async () => [token],
      getMarketData: async () => null,
      getTrades: async () => trades,
    },
    getTokenByAddress as GetTokenByAddressUseCase,
    {
      execute: async () => [1, 2, 3].map((t) => ({ timestamp: t })),
    } as unknown as GetCandlesticksUseCase,
  );

describe('GeckoTerminalService', () => {
  it("describes a pool from its token's last 24h of trades", async () => {
    const pool = await service().pool(chain, POOL);
    expect(pool.token).toBe(token);
    expect(pool.latestTrade).toBe(trades[0]);
    expect(pool.quotePriceUsd).toBe(2000);
    expect(pool.volume24hQuote).toBe(3);
    expect([pool.buys24h, pool.sells24h]).toEqual([1, 1]);
  });

  it('reports an unknown pool or token as not found', async () => {
    const unknown = '0x9999999999999999999999999999999999999999';
    await expect(service().pool(chain, unknown)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service().trades(chain, unknown)).rejects.toBeInstanceOf(NotFoundError);
    const failing = service({ execute: async () => Promise.reject(new Error('rpc down')) });
    await expect(failing.token(chain, unknown)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('serves the newest candles up to the limit', async () => {
    const { candles } = await service().ohlcv(POOL, 60, 2);
    expect(candles.map((c) => c.timestamp)).toEqual([2, 3]);
  });
});
