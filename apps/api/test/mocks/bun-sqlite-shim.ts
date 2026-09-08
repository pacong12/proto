import { DatabaseSync, StatementSync } from 'node:sqlite';

export class Database {
  private inner: DatabaseSync;

  constructor(location: string) {
    this.inner = new DatabaseSync(location);
  }

  run(sql: string): void {
    this.inner.exec(sql);
  }

  exec(sql: string): void {
    this.inner.exec(sql);
  }

  prepare(sql: string): StatementSync {
    return this.inner.prepare(sql);
  }

  close(): void {
    this.inner.close();
  }
}
