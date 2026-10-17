import { defineConfig } from 'vitepress';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { renderSiteUrls, resolveSiteUrls } from '../../../packages/shared-types/src/constants/site';

// Same source as the frontoffice: VITE_APP_URL / VITE_DOCS_URL (repo .env or build env),
// defaulting to goton.fun / docs.goton.fun. Markdown, frontmatter and the static files listed in
// SITE_URL_FILES use %APP_URL% / %APP_HOST% / %DOCS_URL% placeholders rendered from these.
const env = loadEnv('production', path.resolve(__dirname, '../../..'), 'VITE_');
const SITE = resolveSiteUrls({ appUrl: env.VITE_APP_URL, docsUrl: env.VITE_DOCS_URL });
const SITE_URL_FILES = ['robots.txt', 'llms.txt', 'opengraph-docs.svg', '.well-known/security.txt'];

const TRANSLATED_LOCALES = ['id', 'zh', 'ja', 'ko', 'es', 'ru', 'ar', 'fr', 'de', 'pt'];

/**
 * The language switcher links to the same path in every locale, but most locales translate only a
 * few pages. Wherever a locale lacks a page, write a redirect to the English page instead of
 * leaving a 404 (noindex, canonical to the English URL).
 */
function writeUntranslatedRedirects(outDir: string): void {
  const englishPages: string[] = [];
  const walk = (dir: string, rel = ''): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        if (rel === '' && (TRANSLATED_LOCALES.includes(entry.name) || entry.name === 'assets'))
          continue;
        walk(path.join(dir, entry.name), relPath);
      } else if (entry.name.endsWith('.html') && relPath !== '404.html') {
        englishPages.push(relPath);
      }
    }
  };
  walk(outDir);
  for (const locale of TRANSLATED_LOCALES) {
    for (const page of englishPages) {
      const target = path.join(outDir, locale, page);
      if (fs.existsSync(target)) continue;
      const url = '/' + page.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(
        target,
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">` +
          `<link rel="canonical" href="${SITE.docsUrl}${url}"><meta http-equiv="refresh" content="0; url=${url}">` +
          `<title>Redirecting</title></head><body><a href="${url}">Continue to the English page</a>` +
          `<script>location.replace(${JSON.stringify(url)})</script></body></html>`,
      );
    }
  }
}

export default defineConfig({
  title: 'Goton User Guide',
  description:
    'Clean, step-by-step user guide and knowledge base for trading, launching, and exploring tokens on Robinhood Chain and Arc Network.',
  srcDir: './src',
  outDir: './dist',
  cleanUrls: true,
  sitemap: {
    hostname: SITE.docsUrl,
  },
  markdown: {
    config(md) {
      md.core.ruler.before('normalize', 'proto-site-urls', (state) => {
        state.src = renderSiteUrls(state.src, SITE);
      });
    },
  },
  transformPageData(pageData) {
    pageData.frontmatter = JSON.parse(renderSiteUrls(JSON.stringify(pageData.frontmatter), SITE));
  },
  buildEnd(siteConfig) {
    for (const file of SITE_URL_FILES) {
      const target = path.join(siteConfig.outDir, file);
      if (fs.existsSync(target)) {
        fs.writeFileSync(target, renderSiteUrls(fs.readFileSync(target, 'utf8'), SITE));
      }
    }
    writeUntranslatedRedirects(siteConfig.outDir);
  },
  head: [
    // Development deploys (workers.dev) must not be indexed.
    ...(SITE.docsHost.endsWith('.workers.dev')
      ? [
          ['meta', { name: 'robots', content: 'noindex, nofollow' }] as [
            string,
            Record<string, string>,
          ],
        ]
      : []),
    [
      'meta',
      { name: 'google-site-verification', content: 'l9eLMSYaQIM97O5MwBLUS5_vtevxk4QnDqRrequPcbQ' },
    ],
    [
      'script',
      {
        async: '',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-WEG4HF874Z',
      },
    ],
    [
      'script',
      {},
      "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-WEG4HF874Z');",
    ],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'manifest', href: '/manifest.json' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
      },
    ],
    ['meta', { name: 'theme-color', content: '#E7239F' }],
    ['meta', { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' }],
    ['meta', { name: 'referrer', content: 'strict-origin-when-cross-origin' }],
    [
      'meta',
      {
        name: 'robots',
        content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
      },
    ],
    [
      'meta',
      {
        name: 'keywords',
        content:
          'goton,docs,guide,launchpad,token launch,bonding curve,uniswap,robinhood chain,crypto,web3,defi',
      },
    ],
    ['meta', { name: 'author', content: 'Goton Labs' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:site_name', content: 'Goton Knowledge Base' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'Goton User Guide · Fair Token Launchpad',
      },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Clean, step-by-step user guide and knowledge base for trading, launching, and exploring tokens on Robinhood Chain.',
      },
    ],
    [
      'meta',
      {
        property: 'og:image',
        content: `${SITE.docsUrl}/opengraph-docs.svg`,
      },
    ],
    ['meta', { property: 'og:image:type', content: 'image/svg+xml' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'Goton Knowledge Base & User Guide',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: '@gotondotfun' }],
    [
      'meta',
      {
        name: 'twitter:title',
        content: 'Goton User Guide · Fair Token Launchpad',
      },
    ],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'Clean, step-by-step user guide and knowledge base for trading, launching, and exploring tokens on Robinhood Chain.',
      },
    ],
    [
      'meta',
      {
        name: 'twitter:image',
        content: `${SITE.docsUrl}/opengraph-docs.svg`,
      },
    ],
    [
      'meta',
      {
        name: 'twitter:image:alt',
        content: 'Goton Knowledge Base & User Guide',
      },
    ],
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${SITE.docsUrl}/#website`,
            url: `${SITE.docsUrl}`,
            name: 'Goton Documentation & User Guide',
            description:
              'Clean, step-by-step user guide and knowledge base for trading, launching, and exploring tokens on Robinhood Chain.',
            publisher: {
              '@type': 'Organization',
              name: 'Goton Labs',
              url: `${SITE.appUrl}`,
              logo: `${SITE.appUrl}/favicon.svg`,
            },
          },
          {
            '@type': 'TechArticle',
            '@id': `${SITE.docsUrl}/#article`,
            url: `${SITE.docsUrl}`,
            name: 'Goton Protocol User Documentation',
            headline: 'Fair Token Launchpad Protocol Guides & Reference',
          },
        ],
      }),
    ],
  ],
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../src'),
      },
    },
    // @ts-expect-error Tailwind v4 Vite 6 plugin interface divergence with VitePress bundled Vite 5
    plugins: [tailwindcss()],
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Getting Started', link: '/protocol/overview' },
          { text: 'How to Launch', link: '/protocol/launches' },
          { text: 'Trading Guide', link: '/protocol/trading-guide' },
          { text: 'FAQ', link: '/protocol/faq' },
          { text: 'Safety', link: '/protocol/anti-snipe' },
          { text: 'Launchpad App', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Getting Started',
            collapsed: false,
            items: [
              { text: 'What is Goton?', link: '/protocol/overview' },
              { text: 'Frequently Asked Questions', link: '/protocol/faq' },
            ],
          },
          {
            text: 'Token Launches & Trading',
            collapsed: false,
            items: [
              { text: 'How to Launch a Token', link: '/protocol/launches' },
              { text: 'Trading & Swaps Guide', link: '/protocol/trading-guide' },
              { text: 'Anti-Snipe & Fair Launch', link: '/protocol/anti-snipe' },
            ],
          },
          {
            text: 'Economics & Community',
            collapsed: false,
            items: [
              { text: 'Creator Fees & Rewards', link: '/protocol/fees-and-burns' },
              { text: 'Community Takeovers (CTO)', link: '/protocol/community-takeovers' },
            ],
          },
          {
            text: 'Network & Contracts',
            collapsed: false,
            items: [
              { text: 'Network Setup (Robinhood & Arc)', link: '/integration/network' },
              { text: 'Verified Smart Contracts', link: '/integration/contracts' },
            ],
          },
          {
            text: 'Legal & Policies',
            collapsed: true,
            items: [
              { text: 'Terms of Service', link: '/terms-of-service' },
              { text: 'Privacy Policy', link: '/privacy-policy' },
              { text: 'Cookie & Storage Policy', link: '/cookie-policy' },
            ],
          },
        ],
      },
    },

    id: {
      label: 'Bahasa Indonesia',
      lang: 'id',
      link: '/id/',
      themeConfig: {
        nav: [
          { text: 'Mulai', link: '/id/protocol/overview' },
          { text: 'Cara Launch', link: '/id/protocol/launches' },
          { text: 'Panduan Trading', link: '/id/protocol/trading-guide' },
          { text: 'FAQ', link: '/id/protocol/faq' },
          { text: 'Keamanan', link: '/id/protocol/anti-snipe' },
          { text: 'Aplikasi Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Panduan Pengguna',
            collapsed: false,
            items: [
              { text: 'Apa itu Goton?', link: '/id/protocol/overview' },
              { text: 'Pertanyaan Umum (FAQ)', link: '/id/protocol/faq' },
            ],
          },
          {
            text: 'Peluncuran & Trading',
            collapsed: false,
            items: [
              { text: 'Cara Meluncurkan Token', link: '/id/protocol/launches' },
              { text: 'Panduan Trading & Swap', link: '/id/protocol/trading-guide' },
              { text: 'Anti-Snipe & Fair Launch', link: '/id/protocol/anti-snipe' },
            ],
          },
          {
            text: 'Ekonomi & Komunitas',
            collapsed: false,
            items: [
              { text: 'Fee Kreator & Reward', link: '/id/protocol/fees-and-burns' },
              { text: 'Pengambilalihan Komunitas (CTO)', link: '/id/protocol/community-takeovers' },
            ],
          },
          {
            text: 'Jaringan & Kontrak',
            collapsed: false,
            items: [
              { text: 'Konfigurasi Jaringan', link: '/id/integration/network' },
              { text: 'Kontrak Pintar Terverifikasi', link: '/id/integration/contracts' },
            ],
          },
          {
            text: 'Hukum & Kebijakan',
            collapsed: true,
            items: [
              { text: 'Ketentuan Layanan', link: '/id/terms-of-service' },
              { text: 'Kebijakan Privasi', link: '/id/privacy-policy' },
              { text: 'Kebijakan Cookie & Penyimpanan', link: '/id/cookie-policy' },
            ],
          },
        ],
      },
    },

    zh: {
      label: '简体中文',
      lang: 'zh',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '快速开始', link: '/zh/protocol/overview' },
          { text: '发行代币', link: '/zh/protocol/launches' },
          { text: '交易指南', link: '/zh/protocol/trading-guide' },
          { text: '常见问题', link: '/zh/protocol/faq' },
          { text: '安全机制', link: '/zh/protocol/anti-snipe' },
          { text: '进入 Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: '新手指南',
            collapsed: false,
            items: [
              { text: '什么是 Goton？', link: '/zh/protocol/overview' },
              { text: '常见问题 (FAQ)', link: '/zh/protocol/faq' },
            ],
          },
          {
            text: '代币发行与交易',
            collapsed: false,
            items: [
              { text: '如何发行代币', link: '/zh/protocol/launches' },
              { text: '交易与兑换指南', link: '/zh/protocol/trading-guide' },
              { text: '防抢跑与公平发射', link: '/zh/protocol/anti-snipe' },
            ],
          },
          {
            text: '代币经济与社区',
            collapsed: false,
            items: [
              { text: '创作者分成与回购销毁', link: '/zh/protocol/fees-and-burns' },
              { text: '社区接管 (CTO)', link: '/zh/protocol/community-takeovers' },
            ],
          },
          {
            text: '网络与合约',
            collapsed: false,
            items: [
              { text: '网络配置 (Robinhood & Arc)', link: '/zh/integration/network' },
              { text: '已验证智能合约', link: '/zh/integration/contracts' },
            ],
          },
          {
            text: '法律与政策',
            collapsed: true,
            items: [
              { text: '服务条款', link: '/zh/terms-of-service' },
              { text: '隐私政策', link: '/zh/privacy-policy' },
              { text: 'Cookie 与存储政策', link: '/zh/cookie-policy' },
            ],
          },
        ],
      },
    },

    es: {
      label: 'Español',
      lang: 'es',
      link: '/es/',
      themeConfig: {
        nav: [
          { text: 'Primeros Pasos', link: '/es/protocol/overview' },
          { text: 'Cómo Lanzar', link: '/es/protocol/overview' },
          { text: 'Ir a Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Guía del Usuario',
            collapsed: false,
            items: [{ text: '¿Qué es Goton?', link: '/es/protocol/overview' }],
          },
        ],
      },
    },

    ja: {
      label: '日本語',
      lang: 'ja',
      link: '/ja/',
      themeConfig: {
        nav: [
          { text: '概要', link: '/ja/protocol/overview' },
          { text: 'トークン作成', link: '/ja/protocol/overview' },
          { text: 'Launchpadアプリ', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'ユーザーハンドブック',
            collapsed: false,
            items: [{ text: 'Goton とは？', link: '/ja/protocol/overview' }],
          },
        ],
      },
    },

    ko: {
      label: '한국어',
      lang: 'ko',
      link: '/ko/',
      themeConfig: {
        nav: [
          { text: '시작하기', link: '/ko/protocol/overview' },
          { text: '토큰 런칭', link: '/ko/protocol/overview' },
          { text: '런치패드 앱', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: '사용자 가이드',
            collapsed: false,
            items: [{ text: 'Goton란 무엇인가요?', link: '/ko/protocol/overview' }],
          },
        ],
      },
    },

    ru: {
      label: 'Русский',
      lang: 'ru',
      link: '/ru/',
      themeConfig: {
        nav: [
          { text: 'Введение', link: '/ru/protocol/overview' },
          { text: 'Создание токена', link: '/ru/protocol/overview' },
          { text: 'Приложение Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Руководство пользователя',
            collapsed: false,
            items: [{ text: 'Что такое Goton?', link: '/ru/protocol/overview' }],
          },
        ],
      },
    },

    ar: {
      label: 'العربية',
      lang: 'ar',
      link: '/ar/',
      themeConfig: {
        nav: [
          { text: 'البداية', link: '/ar/protocol/overview' },
          { text: 'إنشاء عملة', link: '/ar/protocol/overview' },
          { text: 'تطبيق المنصة', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'دليل المستخدم',
            collapsed: false,
            items: [{ text: 'ما هو Goton؟', link: '/ar/protocol/overview' }],
          },
        ],
      },
    },

    fr: {
      label: 'Français',
      lang: 'fr',
      link: '/fr/',
      themeConfig: {
        nav: [
          { text: 'Premiers Pas', link: '/fr/protocol/overview' },
          { text: 'Lancer un Token', link: '/fr/protocol/overview' },
          { text: 'Application Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Guide Utilisateur',
            collapsed: false,
            items: [{ text: 'Qu’est-ce que Goton ?', link: '/fr/protocol/overview' }],
          },
        ],
      },
    },

    de: {
      label: 'Deutsch',
      lang: 'de',
      link: '/de/',
      themeConfig: {
        nav: [
          { text: 'Erste Schritte', link: '/de/protocol/overview' },
          { text: 'Token erstellen', link: '/de/protocol/overview' },
          { text: 'Launchpad App', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Benutzerhandbuch',
            collapsed: false,
            items: [{ text: 'Was ist Goton?', link: '/de/protocol/overview' }],
          },
        ],
      },
    },

    pt: {
      label: 'Português',
      lang: 'pt',
      link: '/pt/',
      themeConfig: {
        nav: [
          { text: 'Primeiros Passos', link: '/pt/protocol/overview' },
          { text: 'Criar Token', link: '/pt/protocol/overview' },
          { text: 'App Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Manual do Usuário',
            collapsed: false,
            items: [{ text: 'O que é o Goton?', link: '/pt/protocol/overview' }],
          },
        ],
      },
    },
  },

  themeConfig: {
    notFound: {
      title: 'PAGE NOT FOUND',
      quote:
        'This page does not exist or has moved. Use the search, or start again from the guide home.',
      linkLabel: 'Go to the guide home',
      linkText: 'Back to the guide',
    },
    siteTitle: 'Goton Guide',
    darkModeSwitchLabel: 'Appearance',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme',
    logo: {
      light: '/logo-black.svg',
      dark: '/logo-white.svg',
      alt: 'Goton',
    },
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    socialLinks: [
      { icon: 'x', link: 'https://x.com/gotondotfun' },
      { icon: 'github', link: 'https://github.com/pacong12/proto' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright:
        'Copyright © 2026 Goton Labs. Multi-chain launchpad protocol on Robinhood Chain and Arc Network.',
    },
  },
});
