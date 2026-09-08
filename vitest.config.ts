import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@proto/shared-types': path.resolve(__dirname, './packages/shared-types/src/index.ts'),
    },
  },
});
