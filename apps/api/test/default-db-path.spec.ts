import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('default database path', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // Resolved from the source file's folder: moving it must not open a new, empty database.
  it('stays at apps/api/proto.sqlite', async () => {
    vi.stubEnv('DB_PATH', '');
    vi.resetModules();
    const { defaultDbPath } = await import('../src/core/sqlite/sqlite-rows');
    expect(defaultDbPath).toBe(path.resolve(__dirname, '../proto.sqlite'));
  });
});
