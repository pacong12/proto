import { defineConfig } from 'vitepress';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  title: 'Proto User Guide',
  description:
    'Clean, step-by-step user guide and knowledge base for trading, launching, and exploring tokens on Robinhood Chain.',
  srcDir: './src',
  outDir: './dist',
  cleanUrls: true,
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
          { text: 'Robinhood Chain Setup', link: '/integration/network' },
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
        'Copyright © 2026 Proto Labs. Non-custodial launchpad protocol on Robinhood Chain.',
    },
  },
});
