import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  backupDatabase,
  listBackups,
  openCheckedDatabase,
} from '../src/modules/tokens/infrastructure/adapters/sqlite-maintenance';

describe('SQLite maintenance (DR-04)', () => {
  let dir: string;
  let dbPath: string;
  const logs: string[] = [];
  const log = (m: string) => logs.push(m);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-db-'));
    dbPath = path.join(dir, 'proto.sqlite');
    logs.length = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function seed(value: string) {
    const db = openCheckedDatabase(dbPath, log);
    db.run('CREATE TABLE IF NOT EXISTS t (v TEXT)');
    db.run(`INSERT INTO t VALUES ('${value}')`);
    return db;
  }

  it('opens a healthy database without touching it', () => {
    seed('a').close();
    const db = openCheckedDatabase(dbPath, log);
    expect(db.query('SELECT v FROM t').all()).toEqual([{ v: 'a' }]);
    expect(logs).toEqual([]);
    db.close();
  });

  it('never moves a locked (but healthy) database aside', () => {
    seed('a').close();
    const holder = new Database(dbPath);
    holder.run('BEGIN EXCLUSIVE');
    holder.run("INSERT INTO t VALUES ('b')");
    expect(() => openCheckedDatabase(dbPath, log, 50)).toThrow(/locked/);
    holder.run('ROLLBACK');
    holder.close();
    expect(fs.readdirSync(dir).filter((f) => f.includes('.corrupt-'))).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('keeps only the newest backups', () => {
    const db = seed('a');
    for (let i = 0; i < 4; i++) {
      backupDatabase(db, dbPath, 2);
      // distinct timestamps in file names
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
    expect(listBackups(dbPath)).toHaveLength(2);
    db.close();
  });

  it('moves a malformed file aside and restores the newest backup', () => {
    const db = seed('from-backup');
    backupDatabase(db, dbPath);
    db.close();
    fs.writeFileSync(dbPath, Buffer.alloc(8192, 0x41));

    const restored = openCheckedDatabase(dbPath, log);
    expect(restored.query('SELECT v FROM t').all()).toEqual([{ v: 'from-backup' }]);
    expect(fs.readdirSync(dir).some((f) => f.includes('.corrupt-'))).toBe(true);
    restored.close();
  });

  it('starts empty when no backup exists', () => {
    fs.writeFileSync(dbPath, Buffer.alloc(8192, 0x41));
    const db = openCheckedDatabase(dbPath, log);
    expect(db.query("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([]);
    expect(logs.at(-1)).toContain('no healthy backup');
    db.close();
  });
});
