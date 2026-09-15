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
    nav: [
      { text: 'Getting Started', link: '/protocol/overview' },
      { text: 'How to Launch', link: '/protocol/launches' },
      { text: 'Trading & Swaps', link: '/protocol/trading-guide' },
      { text: 'Safety & Protection', link: '/protocol/anti-snipe' },
      { text: 'Terms & Privacy', link: '/terms-of-service' },
      { text: 'Launchpad App', link: 'https://proto.family' },
    ],
    sidebar: [
      {
        text: 'User Handbook',
        items: [
          { text: 'What is Proto?', link: '/protocol/overview' },
          { text: 'Launching a Token', link: '/protocol/launches' },
          { text: 'Trading & Swaps Guide', link: '/protocol/trading-guide' },
          { text: 'Anti-Snipe & Fair Launch', link: '/protocol/anti-snipe' },
          { text: 'Creator Fees & Rewards', link: '/protocol/fees-and-burns' },
          { text: 'Community Takeovers (CTO)', link: '/protocol/community-takeovers' },
        ],
      },
      {
        text: 'Network & Network Setup',
        items: [
          { text: 'Robinhood Chain Setup', link: '/integration/network' },
          { text: 'Verified Smart Contracts', link: '/integration/contracts' },
        ],
      },
      {
        text: 'Legal & Privacy',
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
