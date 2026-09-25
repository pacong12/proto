import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  envDir: path.resolve(__dirname, '../../'),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('@reown') ||
              id.includes('@walletconnect') ||
              id.includes('@wagmi') ||
              id.includes('viem')
            ) {
              return 'web3-wallet';
            }
            if (id.includes('lightweight-charts')) {
              return 'charts';
            }
            if (
              id.includes('radix-vue') ||
              id.includes('reka-ui') ||
              id.includes('components/ui/select')
            ) {
              return 'ui-radix';
            }
            if (id.includes('vue') || id.includes('vue-router') || id.includes('@vueuse')) {
              return 'vue-core';
            }
            if (id.includes('lucide-vue-next')) {
              return 'lucide-icons';
            }
          }
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
