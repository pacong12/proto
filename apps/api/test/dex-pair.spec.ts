import { afterAll, describe, expect, it } from 'vitest';
import { server } from '../src/server';
import { SqliteTokenRepository } from '../src/modules/tokens/infrastructure/adapters/sqlite-token.repository';

// Fresh addresses per run: responses are cached (Redis when REDIS_URL is set) by pool address.
const randomAddress = (): `0x${string}` =>
  `0x${Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
const TOKEN = randomAddress();
const POOL = randomAddress();

describe('GET /dex/pair', () => {
  // Same database file as the server's repository.
  const repository = new SqliteTokenRepository();

  afterAll(() => {
    // Leave the shared database as it was.
    (repository as unknown as { db: { exec(sql: string): void } }).db.exec(
      `DELETE FROM tokens WHERE address = '${TOKEN}'`,
    );
    repository.close();
  });

  it('identifies the DEX as goton and links pairs to the app domain', async () => {
    await repository.save({
      address: TOKEN,
      name: 'Pair Test',
      symbol: 'PAIR',
      decimals: 18,
      totalSupply: '1000000000000000000000000',
      logo: '',
      description: '',
      socials: {},
      deployer: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      pairedToken: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      poolAddress: POOL,
      isToken0: true,
      poolFee: 10000,
      positionId: 1n,
      restrictionsEndBlock: 0n,
      launchBlock: 1n,
      createdAt: 1700000000000,
      initialBuyAmount: '0',
    });

    const res = await server.fetch(new Request(`http://localhost:3001/dex/pair?id=${POOL}`));
    expect(res.status).toBe(200);
    const pair = await res.json();
    expect(pair.dexId).toBe('goton');
    expect(pair.labels).toEqual(['goton-v2']);
    expect(pair.url).toBe(`https://goton.fun/trade/${TOKEN}`);
  });

  it('finds a v4 pair by its 32-byte pool id, and serves its events for any block range', async () => {
    const token = randomAddress();
    const poolId =
      `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
    await repository.save({
      address: token,
      name: 'V4 Pair',
      symbol: 'V4P',
      decimals: 18,
      totalSupply: '1000000000000000000000000000',
      logo: '',
      description: '',
      socials: {},
      deployer: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      pairedToken: '0x3600000000000000000000000000000000000000',
      poolAddress: poolId,
      isToken0: false,
      poolFee: 10000,
      positionId: 0n,
      restrictionsEndBlock: 0n,
      launchBlock: 1n,
      createdAt: 1700000000000,
      initialBuyAmount: '0',
      version: 'v4',
    } as never);
    // Two swaps in one transaction, then 1,000 newer trades.
    const trade = (block: number, logIndex: number) => ({
      id: `0x${block.toString(16).padStart(64, '0')}-${logIndex}`,
      tokenAddress: token,
      poolAddress: poolId,
      trader: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' as `0x${string}`,
      isBuy: true,
      tokenAmount: '1000',
      wethAmount: '1',
      priceUsd: 0.001,
      blockNumber: BigInt(block),
      transactionHash: `0x${block.toString(16).padStart(64, '0')}` as `0x${string}`,
      timestamp: 1700000000000 + block,
    });
    await repository.saveTrade(trade(100, 3));
    await repository.saveTrade(trade(100, 7));
    for (let b = 1_000; b < 2_000; b++) await repository.saveTrade(trade(b, 0));

    try {
      const pair = await server.fetch(
        new Request(`http://localhost:3001/dex/pair?id=5042_${poolId}`),
      );
      expect(pair.status).toBe(200);

      const res = await server.fetch(
        new Request(`http://localhost:3001/dex/events?id=5042_${poolId}&fromBlock=100&toBlock=100`),
      );
      const { events } = await res.json();
      expect(events).toHaveLength(2);
      expect(events.map((e: { eventIndex: number }) => e.eventIndex)).toEqual([3, 7]);
    } finally {
      const db = (repository as unknown as { db: { exec(sql: string): void } }).db;
      db.exec(`DELETE FROM trades WHERE tokenAddress = '${token}'`);
      db.exec(`DELETE FROM tokens WHERE address = '${token}'`);
    }
  });
});
