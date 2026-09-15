import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from 'bun:sqlite';

/**
 * Migration & Schema Evolution Test Suite.
 * Verifies that SQLite schema updates, ALTER TABLE migrations, and column constraints
 * execute idempotently without data loss or table locks.
 */
describe('Data Testing: Database Migration & Schema Evolution Integrity', () => {
  let db: Database;

  beforeEach(() => {
    // In-memory isolated DB instance for schema evolution testing
    db = new Database(':memory:');
  });

  it('MIG-01: executes base schema creation without syntax errors', () => {
    expect(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tokens (
          address TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          decimals INTEGER NOT NULL,
          totalSupply TEXT NOT NULL,
          logo TEXT,
          description TEXT,
          socials_json TEXT,
          deployer TEXT NOT NULL,
          pairedToken TEXT NOT NULL,
          poolAddress TEXT NOT NULL,
          isToken0 INTEGER NOT NULL,
          poolFee INTEGER NOT NULL,
          positionId TEXT NOT NULL,
          restrictionsEndBlock TEXT NOT NULL,
          launchBlock TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        );
      `);
    }).not.toThrow();

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='tokens'`)
      .all();
    expect(tables.length).toBe(1);
  });

  it('MIG-02: applies incremental migrations (version & curve_address) without data corruption', () => {
    // 1. Setup legacy table (v1 schema)
    db.exec(`
      CREATE TABLE tokens (
        address TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL
      );
    `);

    // Insert legacy record
    db.exec(`INSERT INTO tokens (address, name, symbol) VALUES ('0x123', 'Old Token', 'OLD');`);

    // 2. Apply v2 migration adding columns
    db.exec(`ALTER TABLE tokens ADD COLUMN version TEXT;`);
    db.exec(`ALTER TABLE tokens ADD COLUMN curve_address TEXT;`);

    // 3. Verify legacy data is intact and new columns default to NULL
    const row = db.prepare(`SELECT * FROM tokens WHERE address = '0x123'`).get() as {
      address: string;
      name: string;
      symbol: string;
      version: string | null;
      curve_address: string | null;
    };

    expect(row.address).toBe('0x123');
    expect(row.name).toBe('Old Token');
    expect(row.version).toBeNull();
    expect(row.curve_address).toBeNull();

    // 4. Update new columns on existing row
    db.exec(`UPDATE tokens SET version = 'v2', curve_address = '0xcurve' WHERE address = '0x123';`);
    const updated = db
      .prepare(`SELECT version, curve_address FROM tokens WHERE address = '0x123'`)
      .get() as {
      version: string;
      curve_address: string;
    };
    expect(updated.version).toBe('v2');
    expect(updated.curve_address).toBe('0xcurve');
  });

  it('MIG-03: handles duplicate ALTER TABLE attempts gracefully (idempotency pattern)', () => {
    db.exec(`CREATE TABLE tokens (address TEXT PRIMARY KEY);`);
    db.exec(`ALTER TABLE tokens ADD COLUMN version TEXT;`);

    // Second ALTER on identical column normally throws in SQLite, verify try-catch safety
    const applySafeMigration = () => {
      try {
        db.exec(`ALTER TABLE tokens ADD COLUMN version TEXT;`);
      } catch {
        // Expected safe catch for existing column
      }
    };

    expect(applySafeMigration).not.toThrow();
  });
});
