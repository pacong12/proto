import { defineConfig, loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import {
  renderSiteUrls,
  resolveSiteUrls,
  type SiteUrls,
} from '../../packages/shared-types/src/constants/site';

const envDir = path.resolve(__dirname, '../../');

/** Static files whose %APP_URL% / %DOCS_URL% placeholders are rendered with the site URLs. */
const SITE_URL_FILES: Record<string, string> = {
  'robots.txt': 'text/plain; charset=utf-8',
  'sitemap.xml': 'application/xml; charset=utf-8',
  'llms.txt': 'text/plain; charset=utf-8',
  'opengraph-image.svg': 'image/svg+xml',
};

function siteUrlsPlugin(urls: SiteUrls): Plugin {
  let publicDir = '';
  let outDir = '';
  return {
    name: 'proto-site-urls',
    configResolved(config) {
      publicDir = config.publicDir;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = (req.url ?? '').split('?')[0].replace(/^\//, '');
        const type = SITE_URL_FILES[file];
        if (!type) return next();
        res.setHeader('Content-Type', type);
        res.end(renderSiteUrls(fs.readFileSync(path.join(publicDir, file), 'utf8'), urls));
      });
    },
    closeBundle() {
      for (const file of Object.keys(SITE_URL_FILES)) {
        const target = path.join(outDir, file);
        if (fs.existsSync(target)) {
          fs.writeFileSync(target, renderSiteUrls(fs.readFileSync(target, 'utf8'), urls));
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // One source for the public URLs: VITE_APP_URL / VITE_DOCS_URL, defaulting to goton.fun.
  // Exported back to process.env so index.html (%VITE_APP_URL%) and import.meta.env always see them.
  const env = loadEnv(mode, envDir, 'VITE_');
  const urls = resolveSiteUrls({ appUrl: env.VITE_APP_URL, docsUrl: env.VITE_DOCS_URL });
  process.env.VITE_APP_URL = urls.appUrl;
  process.env.VITE_DOCS_URL = urls.docsUrl;

  return {
    plugins: [vue(), tailwindcss(), siteUrlsPlugin(urls)],
    envDir,
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
          target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3011',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@proto/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
        '@proto/contracts-abi': path.resolve(
          __dirname,
          '../../packages/contracts-abi/src/index.ts',
        ),
        '@proto/math-sdk': path.resolve(__dirname, '../../packages/math-sdk/src/index.ts'),
      },
    },
  };
});
