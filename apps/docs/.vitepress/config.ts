import { defineConfig } from 'vitepress';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  title: 'Proto User Guide',
  description:
    'Clean, step-by-step user guide and knowledge base for trading, launching, and exploring tokens on Robinhood Chain and Arc Network.',
  srcDir: './src',
  outDir: './dist',
  cleanUrls: true,
  sitemap: {
    hostname: 'https://docs.proto.family',
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'manifest', href: '/manifest.json' }],
    ['meta', { name: 'theme-color', content: '#10b981' }],
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
          'proto,docs,guide,launchpad,token launch,bonding curve,uniswap,robinhood chain,crypto,web3,defi',
      },
    ],
    ['meta', { name: 'author', content: 'Proto Labs' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:site_name', content: 'Proto Knowledge Base' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'Proto User Guide · Fair Token Launchpad',
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
        content: 'https://docs.proto.family/opengraph-docs.svg',
      },
    ],
    ['meta', { property: 'og:image:type', content: 'image/svg+xml' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'Proto Knowledge Base & User Guide',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: '@protodotfamily' }],
    [
      'meta',
      {
        name: 'twitter:title',
        content: 'Proto User Guide · Fair Token Launchpad',
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
        content: 'https://docs.proto.family/opengraph-docs.svg',
      },
    ],
    [
      'meta',
      {
        name: 'twitter:image:alt',
        content: 'Proto Knowledge Base & User Guide',
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
            '@id': 'https://docs.proto.family/#website',
            url: 'https://docs.proto.family',
            name: 'Proto Documentation & User Guide',
            description:
              'Clean, step-by-step user guide and knowledge base for trading, launching, and exploring tokens on Robinhood Chain.',
            publisher: {
              '@type': 'Organization',
              name: 'Proto Labs',
              url: 'https://proto.family',
              logo: 'https://proto.family/favicon.svg',
            },
          },
          {
            '@type': 'TechArticle',
            '@id': 'https://docs.proto.family/#article',
            url: 'https://docs.proto.family',
            name: 'Proto Protocol User Documentation',
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
          { text: 'Launchpad App', link: 'https://proto.family' },
        ],
        sidebar: [
          {
            text: 'Getting Started',
            collapsed: false,
            items: [
              { text: 'What is Proto?', link: '/protocol/overview' },
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
          { text: 'Aplikasi Launchpad', link: 'https://proto.family' },
        ],
        sidebar: [
          {
            text: 'Panduan Pengguna',
            collapsed: false,
            items: [
              { text: 'Apa itu Proto?', link: '/id/protocol/overview' },
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
          { text: '进入 Launchpad', link: 'https://proto.family' },
        ],
        sidebar: [
          {
            text: '新手指南',
            collapsed: false,
            items: [
              { text: '什么是 Proto？', link: '/zh/protocol/overview' },
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
          { text: 'Ir a Launchpad', link: 'https://proto.family' },
        ],
        sidebar: [
          {
            text: 'Guía del Usuario',
            collapsed: false,
            items: [{ text: '¿Qué es Proto?', link: '/es/protocol/overview' }],
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
          { text: 'Launchpadアプリ', link: 'https://proto.family' },
        ],
        sidebar: [
          {
            text: 'ユーザーハンドブック',
            collapsed: false,
            items: [{ text: 'Proto とは？', link: '/ja/protocol/overview' }],
          },
        ],
      },
    },
  },

  themeConfig: {
    siteTitle: 'Proto Guide',
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/pacong12/proto' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright:
        'Copyright © 2026 Proto Labs. Multi-chain launchpad protocol on Robinhood Chain and Arc Network.',
    },
  },
});
