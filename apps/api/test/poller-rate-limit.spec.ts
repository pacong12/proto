import { describe, expect, it } from 'vitest';
import { HttpRequestError, type PublicClient } from 'viem';
import { ROBINHOOD_CHAIN } from '@goton/shared-types';
import { EventPollerService } from '../src/modules/indexer/infrastructure/event-poller.service';
import { MAX_RANGE_ATTEMPTS } from '../src/modules/indexer/infrastructure/indexer-events';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { isRateLimited } from '../src/core/rpc';

/** What viem throws for an HTTP 429: a status, no code, and no "too many requests" text. */
const http429 = () =>
  new HttpRequestError({ url: 'https://rpc.example', status: 429, details: '"rate"' });

describe('RPC rate limits', () => {
  it("recognises viem's HTTP 429, also wrapped in a cause", () => {
    expect(isRateLimited(http429())).toBe(true);
    expect(isRateLimited(new Error('outer', { cause: http429() }))).toBe(true);
    expect(isRateLimited({ code: -32005, message: 'limit' })).toBe(true);
    expect(isRateLimited(new Error('execution reverted'))).toBe(false);
  });

  it('never skips a block range while the RPC answers 429', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    await repo.setLastIndexedBlock!(ROBINHOOD_CHAIN.name, 1_000n);
    const client = {
      getBlockNumber: async () => 1_100n,
      getLogs: async () => {
        throw http429();
      },
      getBlock: async () => ({ timestamp: 1n }),
      readContract: async () => {
        throw http429();
      },
      multicall: async () => {
        throw http429();
      },
    } as unknown as PublicClient;
    const poller = new EventPollerService(
      client,
      repo,
      {} as never,
      {} as never,
      { getQuoteAssetPriceUsd: async () => 2400 } as never,
      ROBINHOOD_CHAIN,
    );
    Object.assign(poller, { sleep: async () => undefined });

    for (let i = 0; i < MAX_RANGE_ATTEMPTS + 2; i++) await poller.pollEvents();

    expect(poller.lastPollFailed).toBe(true);
    expect(await repo.getLastIndexedBlock!(ROBINHOOD_CHAIN.name)).toBe(1_000n);
  });
});
