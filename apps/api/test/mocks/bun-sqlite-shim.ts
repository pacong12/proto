import { DatabaseSync, StatementSync } from 'node:sqlite';

export class Database {
  private inner: DatabaseSync;

  constructor(location: string) {
    this.inner = new DatabaseSync(location);
    try {
      this.inner.exec('PRAGMA journal_mode = WAL;');
      this.inner.exec('PRAGMA busy_timeout = 10000;');
    } catch {
      // Ignore
    }
  }

  run(sql: string): void {
    let retries = 10;
    while (retries > 0) {
      try {
        this.inner.exec(sql);
        return;
      } catch (err: unknown) {
        const message = (err as Error)?.message || '';
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

  close(): void {
    this.inner.close();
  }
}
