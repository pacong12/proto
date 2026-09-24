import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router'],
          wagmi: ['@wagmi/vue', 'viem'],
          ui: ['radix-vue', 'class-variance-authority', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    port: Number(process.env.VITE_PORT ?? 3010),
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3011',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@proto/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
});
