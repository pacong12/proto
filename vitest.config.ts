import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      vue: path.resolve(__dirname, './apps/frontoffice/node_modules/vue'),
      '@': path.resolve(__dirname, './apps/frontoffice/src'),
      '@proto/shared-types': path.resolve(__dirname, './packages/shared-types/src/index.ts'),
      'bun:sqlite': path.resolve(__dirname, './apps/api/test/mocks/bun-sqlite-shim.ts'),
    },
  },
});
