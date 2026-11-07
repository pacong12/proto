import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteTokenRepository } from '../src/app/storage/sqlite-token.repository';
import { SqliteDatabase } from '../src/core/sqlite/sqlite-database';
import { SqliteTokenStore } from '../src/modules/tokens';
import { SqliteTradeStore } from '../src/modules/trades';
import { SqliteSocialStore } from '../src/modules/social';
import { SqliteOrderStore } from '../src/modules/limit-orders';

const storeClasses = [SqliteTokenStore, SqliteTradeStore, SqliteSocialStore, SqliteOrderStore];

/** Public methods of a store, without the private helpers the facade must not expose. */
function publicMethods(store: { prototype: object }): string[] {
  const privateHelpers = new Set(['constructor', 'getSingleCallout', 'identityAddresses']);
  return Object.getOwnPropertyNames(store.prototype).filter((name) => !privateHelpers.has(name));
}

type AnyMethods = Record<string, (...args: unknown[]) => unknown>;

const forwardingCases = storeClasses.flatMap((store) =>
  publicMethods(store).map((method) => ({
    owner: store.name,
    method,
    prototype: store.prototype as unknown as AnyMethods,
  })),
);

describe('SqliteTokenRepository', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(forwardingCases)('forwards $owner.$method with its arguments and result', (testCase) => {
    const repo = new SqliteTokenRepository(':memory:');
    const result = { from: testCase.method };
    const spy = vi.spyOn(testCase.prototype, testCase.method).mockReturnValue(result);

    const facade = repo as unknown as AnyMethods;
    expect(facade[testCase.method]('first', 2, { third: true })).toBe(result);
    expect(spy).toHaveBeenCalledExactlyOnceWith('first', 2, { third: true });
    repo.close();
  });

  it('gives every method exactly one owning store', () => {
    const names = storeClasses.flatMap(publicMethods);
    expect(new Set(names).size).toBe(names.length);
  });

  it('shares one database: a trade store read sees what the token store wrote', async () => {
    const repo = new SqliteTokenRepository(':memory:');
    const address = `0x${'a1'.repeat(20)}` as `0x${string}`;
    const holder = `0x${'c3'.repeat(20)}` as `0x${string}`;
    await repo.save({
      address,
      name: 'Shared',
      symbol: 'SHR',
      decimals: 18,
      totalSupply: '1000',
      logo: '',
      description: '',
      socials: {},
      deployer: holder,
      pairedToken: holder,
      poolAddress: address,
      isToken0: false,
      poolFee: 0,
      positionId: 0n,
      restrictionsEndBlock: 0n,
      launchBlock: 1n,
      createdAt: 1,
      initialBuyAmount: '0',
      version: 'v2',
    } as never);
    await repo.saveBalances(address, [{ holder, balance: 250n }]);
    await repo.markHoldersIndexed(address);

    const [top] = await repo.getHolders(address, 1);
    expect(top).toMatchObject({ address: holder, balance: '250', percent: 25 });
    repo.close();
  });

  it('closes the shared connection for every store', async () => {
    const close = vi.spyOn(SqliteDatabase.prototype, 'close');
    const repo = new SqliteTokenRepository(':memory:');
    repo.close();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('SqliteDatabase.runInTransaction', () => {
  it('rolls back everything when the callback throws', () => {
    const database = new SqliteDatabase(':memory:');
    const count = () =>
      (database.db.prepare('SELECT COUNT(*) AS n FROM follows').get() as { n: number }).n;

    expect(() =>
      database.runInTransaction(() => {
        database.db
          .prepare('INSERT INTO follows (follower, followee, created_at) VALUES (?, ?, ?)')
          .run('a', 'b', 1);
        throw new Error('stop');
      }),
    ).toThrow('stop');

    expect(count()).toBe(0);
    database.close();
  });
});
