import { afterAll, describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { ARC_NETWORK, ROBINHOOD_CHAIN, type NetworkConfig } from '@goton/shared-types';
import { EventPollerService } from '../src/modules/tokens/infrastructure/indexer/event-poller.service';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';

const hex = (bytes: number) =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

const ZERO = '0x0000000000000000000000000000000000000000';

function pollerFor(
  repository: SqliteTokenRepository,
  network: NetworkConfig,
  buyback: `0x${string}`,
  logs: unknown[],
) {
  const requests: Array<{ address?: string; eventName?: string }> = [];
  const client = {
    getLogs: async (params: { address?: string; event?: { name?: string } }) => {
      requests.push({ address: params.address, eventName: params.event?.name });
      return logs;
    },
    getBlock: async () => ({ timestamp: 1_793_100_000n }),
  } as unknown as PublicClient;
  const poller = new EventPollerService(client, repository, {} as never, {} as never, {} as never, {
    ...network,
    contracts: { ...network.contracts, buyback },
  });
  return { poller, requests };
}

describe('BuybackExecuted indexing', () => {
  const repository = new SqliteTokenRepository();
  afterAll(() => repository.close());

  const burn = (quoteSpent: bigint, tokensBurned: bigint, logIndex: number, tx = hex(32)) => ({
    args: { token: hex(20), quoteSpent, tokensBurned, twapTick: 0 },
    blockNumber: 500n,
    logIndex,
    transactionHash: tx,
  });

  it("stores burns under the chain's ID and counts a re-indexed range once", async () => {
    const buyback = hex(20);
    const logs = [burn(2_500_000n, 1_000n * 10n ** 18n, 1), burn(500_000n, 200n * 10n ** 18n, 2)];
    const { poller, requests } = pollerFor(repository, ARC_NETWORK, buyback, logs);

    expect(await poller.buybacks.pollBuybacks(500n, 500n)).toBe(2);
    await poller.buybacks.pollBuybacks(500n, 500n);

    expect(requests[0]).toEqual({ address: buyback, eventName: 'BuybackExecuted' });
    expect(await repository.getBuybackTotals(String(ARC_NETWORK.chainId))).toEqual({
      totalBurns: 2,
      totalTokensBurned: (1_200n * 10n ** 18n).toString(),
      totalQuoteSpent: '3000000',
    });
    expect((await repository.getBuybackTotals(String(ROBINHOOD_CHAIN.chainId))).totalBurns).toBe(0);
  });

  it('does not query the chain when no buyback contract is deployed', async () => {
    const { poller, requests } = pollerFor(repository, ROBINHOOD_CHAIN, ZERO, [burn(1n, 1n, 1)]);
    expect(await poller.buybacks.pollBuybacks(500n, 500n)).toBe(0);
    expect(requests).toHaveLength(0);
  });

  it('is part of every indexed range', async () => {
    const buyback = hex(20);
    const { poller, requests } = pollerFor(repository, ROBINHOOD_CHAIN, buyback, []);
    await poller.indexRange(500n, 500n).catch(() => undefined);
    expect(requests).toContainEqual({ address: buyback, eventName: 'BuybackExecuted' });
  });
});
