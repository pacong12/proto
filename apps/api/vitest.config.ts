import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

// Run this project's tests with the shared aliases from the root config. NODE_ENV is pinned
// because Nx loads the root .env (the API's runtime settings) into every task, and the server
// switches test-only paths on NODE_ENV. test/setup-db.ts gives each test file its own database.
export default mergeConfig(
  rootConfig,
  defineConfig({ test: { env: { NODE_ENV: 'test' }, setupFiles: ['./test/setup-db.ts'] } }),
);
