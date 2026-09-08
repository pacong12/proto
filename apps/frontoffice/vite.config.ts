import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@proto/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
});
