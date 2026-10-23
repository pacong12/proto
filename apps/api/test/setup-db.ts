import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

// Each test file gets its own SQLite file. Test files run in parallel, and a single shared
// proto.sqlite made writes in one file fail with "database is locked" in another. Within a file
// the server and any repository the test opens without a path still share this database. Runs
// before the test file imports the server, which reads DB_PATH when it loads.
const dbPath = path.join(
  os.tmpdir(),
  `goton-api-test-${process.pid}-${Math.random().toString(36).slice(2)}.sqlite`,
);
process.env.DB_PATH = dbPath;

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
});
