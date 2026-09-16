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
  themeConfig: {
    siteTitle: 'Proto Guide',
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
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
    socialLinks: [{ icon: 'github', link: 'https://github.com/pacong12/proto' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright:
        'Copyright © 2026 Proto Labs. Multi-chain launchpad protocol on Robinhood Chain and Arc Network.',
    },
  },
});
