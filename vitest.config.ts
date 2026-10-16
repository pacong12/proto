import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  publicDir: path.resolve(__dirname, './apps/frontoffice/public'),
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/e2e/**',
    ],
  },
  resolve: {
    alias: {
      vue: path.resolve(__dirname, './apps/frontoffice/node_modules/vue'),
      '@': path.resolve(__dirname, './apps/frontoffice/src'),
      '@goton/shared-types': path.resolve(__dirname, './packages/shared-types/src/index.ts'),
      '@goton/contracts-abi': path.resolve(__dirname, './packages/contracts-abi/src/index.ts'),
      '@goton/math-sdk': path.resolve(__dirname, './packages/math-sdk/src/index.ts'),
      'bun:sqlite': path.resolve(__dirname, './apps/api/test/mocks/bun-sqlite-shim.ts'),
    },
  },
});
