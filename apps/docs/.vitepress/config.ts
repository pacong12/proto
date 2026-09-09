import { defineConfig } from 'vitepress';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  title: 'Proto Docs',
  description: 'Official Protocol & Integration Reference for Proto Launchpad on Robinhood Chain',
  srcDir: './src',
  outDir: './dist',
  cleanUrls: true,
  vite: {
    // @ts-expect-error Tailwind v4 Vite 6 plugin interface divergence with VitePress bundled Vite 5
    plugins: [tailwindcss()],
  },
  themeConfig: {
    siteTitle: 'Proto Docs',
    nav: [
      { text: 'Protocol', link: '/protocol/overview' },
      { text: 'Integration', link: '/integration/network' },
      { text: 'Contracts', link: '/integration/contracts' },
      { text: 'Terms', link: '/terms-of-service' },
      { text: 'Privacy', link: '/privacy-policy' },
      { text: 'Cookies', link: '/cookie-policy' },
      { text: 'Launchpad App', link: 'http://localhost:3000' },
    ],
    sidebar: [
      {
        text: 'Protocol Architecture',
        items: [
          { text: 'Overview', link: '/protocol/overview' },
          { text: 'Atomic Launches', link: '/protocol/launches' },
          { text: 'Anti-Snipe Guard', link: '/protocol/anti-snipe' },
          { text: 'Fee Splits & Burns', link: '/protocol/fees-and-burns' },
          { text: 'Community Takeovers (CTO)', link: '/protocol/community-takeovers' },
        ],
      },
      {
        text: 'Developer Integration',
        items: [
          { text: 'Network & RPC', link: '/integration/network' },
          { text: 'Contract Registry', link: '/integration/contracts' },
          { text: 'Event Indexing', link: '/integration/events' },
          { text: 'Pricing & Graduation Math', link: '/integration/pricing-math' },
        ],
      },
      {
        text: 'Legal & Compliance',
        items: [
          { text: 'Terms of Service', link: '/terms-of-service' },
          { text: 'Privacy Policy', link: '/privacy-policy' },
          { text: 'Cookie Policy', link: '/cookie-policy' },
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
