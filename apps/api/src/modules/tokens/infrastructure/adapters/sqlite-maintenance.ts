import { Database } from 'bun:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const BACKUP_PREFIX = 'proto-';
const BACKUP_SUFFIX = '.sqlite';

export function backupDirFor(dbPath: string): string {
  return path.join(path.dirname(dbPath), 'backups');
}

const BUSY_TIMEOUT_MS = 5_000;

/** Only these mean the file itself is damaged; BUSY/LOCKED/IO errors must never trigger a restore. */
function isCorruptionError(e: unknown): boolean {
  const err = e as { code?: unknown; errno?: unknown; errcode?: unknown } | null;
  if (typeof err?.code === 'string' && /^SQLITE_(CORRUPT|NOTADB)/.test(err.code)) return true;
  // Primary result codes SQLITE_CORRUPT (11) / SQLITE_NOTADB (26): `errno` in Bun, `errcode` in node:sqlite.
  const num = typeof err?.errno === 'number' ? err.errno : err?.errcode;
  return typeof num === 'number' && [11, 26].includes(num & 0xff);
}

/**
 * `PRAGMA quick_check` — true when SQLite reports the file as healthy, false when it is corrupt.
 * Any other failure (e.g. SQLITE_BUSY while another process holds a lock) is rethrown: a locked
 * database is not a damaged one and must not be moved aside.
 */
export function isHealthy(db: Database, busyTimeoutMs = BUSY_TIMEOUT_MS): boolean {
  try {
    db.run(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    const row = db.query('PRAGMA quick_check').get() as Record<string, unknown> | null;
    return row !== null && Object.values(row)[0] === 'ok';
  } catch (e) {
    if (isCorruptionError(e)) return false;
    throw e;
  }
}

/** Backups for this database, newest first. */
export function listBackups(dbPath: string): string[] {
  const dir = backupDirFor(dbPath);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith(BACKUP_SUFFIX))
    .sort()
    .reverse()
    .map((f) => path.join(dir, f));
}

/**
 * DR-04: opens the database and runs an integrity check first. A malformed file (and its WAL/SHM
 * companions) is moved aside, never deleted, and the newest healthy backup is restored in its
 * place. Without a usable backup the API starts on an empty database and re-indexes from chain.
 */
export function openCheckedDatabase(
  dbPath: string,
  log: (msg: string) => void = console.error,
  busyTimeoutMs = BUSY_TIMEOUT_MS,
): Database {
  if (dbPath === ':memory:') return new Database(dbPath);

  let db: Database | null = null;
  try {
    db = new Database(dbPath);
    if (isHealthy(db, busyTimeoutMs)) return db;
  } catch (e) {
    db?.close();
    if (!isCorruptionError(e)) throw e;
    db = null;
  }
  db?.close();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.renameSync(file, `${file}.corrupt-${stamp}`);
  }
  log(`[SQLite] ${dbPath} failed PRAGMA quick_check; moved aside as *.corrupt-${stamp}`);

  for (const backup of listBackups(dbPath)) {
    fs.copyFileSync(backup, dbPath);
    const restored = new Database(dbPath);
    if (isHealthy(restored)) {
      log(
        `[SQLite] restored ${path.basename(backup)}; data newer than the backup is re-indexed from chain`,
      );
      return restored;
    }
    restored.close();
    fs.rmSync(dbPath, { force: true });
  }
  log('[SQLite] no healthy backup found; starting with an empty database');
  return new Database(dbPath);
}

/** Writes a consistent snapshot with `VACUUM INTO` and keeps the newest `keep` files. */
export function backupDatabase(db: Database, dbPath: string, keep = 7): string {
  const dir = backupDirFor(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `${BACKUP_PREFIX}${stamp}${BACKUP_SUFFIX}`);
  db.run(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  for (const old of listBackups(dbPath).slice(Math.max(1, keep))) fs.rmSync(old, { force: true });
  return target;
}
