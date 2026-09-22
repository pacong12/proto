import { DatabaseSync, StatementSync } from 'node:sqlite';

/**
 * Thin shim that maps bun:sqlite Database API onto node:sqlite DatabaseSync
 * so that vitest can run repository tests without Bun runtime.
 *
 * Implemented methods: run, exec, prepare, query, close.
 * query<T>() returns an object with .all() and .get() to match bun:sqlite
 * statement shape used in SqliteTokenRepository.
 */
export class Database {
  private inner: DatabaseSync;

  constructor(location: string) {
    this.inner = new DatabaseSync(location);
  }

  run(sql: string, ...params: unknown[]): void {
    let retries = 10;
    while (retries > 0) {
      try {
        if (params.length > 0) {
          this.inner.prepare(sql).run(...(params as Parameters<StatementSync['run']>));
        } else {
          this.inner.exec(sql);
        }
        return;
      } catch (err: unknown) {
        const message = (err as Error)?.message ?? '';
        if (message.includes('locked') && retries > 1) {
          retries--;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        } else {
          throw err;
        }
      }
    }
  }

  exec(sql: string): void {
    this.run(sql);
  }

  prepare(sql: string): StatementSync {
    return this.inner.prepare(sql);
  }

  /**
   * Mimics bun:sqlite db.query<T, P>(sql) which returns a statement with
   * .all(...params) and .get(...params) methods.
   * The generic type parameters are accepted but not enforced at runtime.
   */
  query<T = Record<string, unknown>>(
    sql: string,
  ): {
    all: (...params: unknown[]) => T[];
    get: (...params: unknown[]) => T | null;
  } {
    const stmt = this.inner.prepare(sql);
    return {
      all: (...params: unknown[]): T[] => {
        const rows =
          params.length > 0
            ? stmt.all(...(params as Parameters<StatementSync['all']>))
            : stmt.all();
        return rows as T[];
      },
      get: (...params: unknown[]): T | null => {
        const row =
          params.length > 0
            ? stmt.get(...(params as Parameters<StatementSync['get']>))
            : stmt.get();
        return (row ?? null) as T | null;
      },
    };
  }

  close(): void {
    this.inner.close();
  }
}
