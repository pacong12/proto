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
});
