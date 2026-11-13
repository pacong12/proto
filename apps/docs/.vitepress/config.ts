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

/** Markdown inline syntax to plain text, one line. */
function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

/** Page source without its frontmatter. */
function pageBody(srcDir: string, relativePath: string): string {
  const file = path.join(srcDir, relativePath);
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
}

/** The first prose paragraph of a page, for pages whose frontmatter has no description. */
function firstParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text || /^(#|<|\||-|\*|>|:::|```|---|!\[|\d+\.)/.test(text)) continue;
    const plain = plainText(text);
    if (plain.length >= 40) return clip(plain, 160);
  }
  return '';
}

/** Question/answer pairs from a FAQ page: each `### question` and the text up to the next heading. */
function faqEntries(body: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  const parts = body.split(/^### /m).slice(1);
  for (const part of parts) {
    const [question, ...rest] = part.split('\n');
    const answer = plainText(
      rest
        .join('\n')
        .split(/^(#{1,3} |---)/m)[0]
        // Paragraphs end with a period and list items become "a; b; c", so they stay separate
        // once the text is one line.
        .replace(/([^.!?:;\s])[ \t]*\n\s*\n/g, '$1.\n\n')
        .replace(/:\s*\n\s*(?:[-*]|\d+\.)\s+/g, ': ')
        .replace(/\n\s*(?:[-*]|\d+\.)\s+/g, '; ')
        .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, ''),
    );
    if (question.trim() && answer) entries.push([plainText(question), answer]);
  }
  return entries;
}

/** JSON for a <script> element, with `<` escaped so page text cannot close the tag. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

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
  transformPageData(pageData, { siteConfig }) {
    pageData.frontmatter = JSON.parse(renderSiteUrls(JSON.stringify(pageData.frontmatter), SITE));
    // Search and AI answers quote the description: give every page its own, from its first
    // paragraph, unless the frontmatter sets one.
    if (!pageData.frontmatter.description) {
      const intro = firstParagraph(
        renderSiteUrls(pageBody(siteConfig.srcDir, pageData.relativePath), SITE),
      );
      if (intro) {
        pageData.frontmatter.description = intro;
        pageData.description = intro;
      }
    }
  },
  // Per-page canonical, Open Graph and X tags, plus hreflang links between the EN / ID / ZH copies
  // of a page (the static head only had one title and description for the whole site).
  transformHead({ pageData, title, description, siteConfig }) {
    const page = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const url = `${SITE.docsUrl}/${page}`;
    const head: Array<[string, Record<string, string>] | [string, Record<string, string>, string]> =
      [
        ['link', { rel: 'canonical', href: url }],
        ['meta', { property: 'og:url', content: url }],
        ['meta', { property: 'og:title', content: title }],
        ['meta', { property: 'og:description', content: description }],
        ['meta', { name: 'twitter:title', content: title }],
        ['meta', { name: 'twitter:description', content: description }],
      ];
    const base = page.replace(/^(id|zh)\//, '');
    const variants: Array<[string, string]> = [
      ['en', base],
      ['id', `id/${base}`],
      ['zh', `zh/${base}`],
    ];
    const exists = (p: string) =>
      fs.existsSync(
        path.join(siteConfig.srcDir, p === '' || p.endsWith('/') ? `${p}index.md` : `${p}.md`),
      );
    const present = variants.filter(([, p]) => exists(p));
    if (present.length > 1) {
      for (const [lang, p] of present) {
        head.push(['link', { rel: 'alternate', hreflang: lang, href: `${SITE.docsUrl}/${p}` }]);
      }
      head.push([
        'link',
        { rel: 'alternate', hreflang: 'x-default', href: `${SITE.docsUrl}/${base}` },
      ]);
    }
    // Structured data: every page is an article of the goton docs; FAQ pages also list their
    // questions and answers (FAQPage) for answer engines.
    const lang = /^(id|zh|ja|ko|es|ru|ar|fr|de|pt)\//.exec(page)?.[1] ?? 'en';
    const graph: Array<Record<string, unknown>> = [];
    if (pageData.frontmatter.layout !== 'home') {
      graph.push({
        '@type': 'TechArticle',
        '@id': `${url}#article`,
        headline: title.replace(/ \| .*$/, ''),
        description,
        url,
        inLanguage: lang,
        ...(pageData.lastUpdated
          ? { dateModified: new Date(pageData.lastUpdated).toISOString() }
          : {}),
        isPartOf: { '@id': `${SITE.docsUrl}/#website` },
      });
    }
    if (/(^|\/)protocol\/faq\.md$/.test(pageData.relativePath)) {
      const entries = faqEntries(
        renderSiteUrls(pageBody(siteConfig.srcDir, pageData.relativePath), SITE),
      );
      if (entries.length) {
        graph.push({
          '@type': 'FAQPage',
          '@id': `${url}#faq`,
          url,
          inLanguage: lang,
          mainEntity: entries.map(([q, a]) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        });
      }
    }
    if (graph.length) {
      head.push([
        'script',
        { type: 'application/ld+json' },
        scriptJson({ '@context': 'https://schema.org', '@graph': graph }),
      ]);
    }
    return head;
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
        property: 'og:image',
        content: `${SITE.docsUrl}/opengraph-docs.png`,
      },
    ],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
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
        name: 'twitter:image',
        content: `${SITE.docsUrl}/opengraph-docs.png`,
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
              { text: 'Limit, Take-Profit & Stop-Loss', link: '/protocol/advanced-orders' },
              { text: 'Anti-Snipe & Fair Launch', link: '/protocol/anti-snipe' },
              { text: 'Protocol Analytics', link: '/protocol/analytics' },
            ],
          },
          {
            text: 'Economics & Community',
            collapsed: false,
            items: [
              { text: 'Creator Fees & Rewards', link: '/protocol/fees-and-burns' },
              { text: 'Community Takeovers (CTO)', link: '/protocol/community-takeovers' },
              { text: 'Feed, Calls, Memestock & Following', link: '/protocol/social' },
            ],
          },
          {
            text: 'Your Profile & Tools',
            collapsed: false,
            items: [
              { text: 'Profiles & Identity', link: '/protocol/profiles' },
              { text: 'Portfolio Dashboard', link: '/protocol/portfolio' },
              { text: 'Creator Reputation', link: '/protocol/reputation' },
              { text: 'Holder Dividends & Vesting', link: '/protocol/dividends-and-vesting' },
              { text: 'PnL Cards & Sharing', link: '/protocol/pnl-cards' },
              { text: 'Price & Market-Cap Alerts', link: '/protocol/price-alerts' },
              { text: 'Invite Friends & Referrals', link: '/protocol/referrals' },
            ],
          },
          {
            text: 'Network & Contracts',
            collapsed: false,
            items: [
              { text: 'Network Setup (Robinhood & Arc)', link: '/integration/network' },
              { text: 'Verified Smart Contracts', link: '/integration/contracts' },
              { text: 'Public API', link: '/integration/api' },
              { text: 'For AI Agents', link: '/integration/agents' },
              { text: 'DEX & Aggregator Listing', link: '/integration/listing-submission' },
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
              { text: 'Limit, Take-Profit & Stop-Loss', link: '/id/protocol/advanced-orders' },
              { text: 'Anti-Snipe & Fair Launch', link: '/id/protocol/anti-snipe' },
              { text: 'Analitik Protokol', link: '/id/protocol/analytics' },
            ],
          },
          {
            text: 'Ekonomi & Komunitas',
            collapsed: false,
            items: [
              { text: 'Fee Kreator & Reward', link: '/id/protocol/fees-and-burns' },
              { text: 'Pengambilalihan Komunitas (CTO)', link: '/id/protocol/community-takeovers' },
              { text: 'Feed, Call, Memestock & Follow', link: '/id/protocol/social' },
            ],
          },
          {
            text: 'Profil & Perkakas',
            collapsed: false,
            items: [
              { text: 'Profil & Identitas', link: '/id/protocol/profiles' },
              { text: 'Dashboard Portofolio', link: '/id/protocol/portfolio' },
              { text: 'Reputasi Kreator', link: '/id/protocol/reputation' },
              { text: 'Dividen Holder & Vesting', link: '/id/protocol/dividends-and-vesting' },
              { text: 'Kartu PnL & Berbagi', link: '/id/protocol/pnl-cards' },
              { text: 'Alert Harga & Market Cap', link: '/id/protocol/price-alerts' },
              { text: 'Ajak Teman & Referral', link: '/id/protocol/referrals' },
            ],
          },
          {
            text: 'Jaringan & Kontrak',
            collapsed: false,
            items: [
              { text: 'Konfigurasi Jaringan', link: '/id/integration/network' },
              { text: 'Kontrak Pintar Terverifikasi', link: '/id/integration/contracts' },
              { text: 'Public API', link: '/id/integration/api' },
              { text: 'Untuk AI Agent', link: '/id/integration/agents' },
              { text: 'Listing DEX & Agregator', link: '/id/integration/listing-submission' },
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
              { text: '限价、止盈与止损', link: '/zh/protocol/advanced-orders' },
              { text: '防抢跑与公平发射', link: '/zh/protocol/anti-snipe' },
              { text: '协议分析', link: '/zh/protocol/analytics' },
            ],
          },
          {
            text: '代币经济与社区',
            collapsed: false,
            items: [
              { text: '创作者分成与回购销毁', link: '/zh/protocol/fees-and-burns' },
              { text: '社区接管 (CTO)', link: '/zh/protocol/community-takeovers' },
              { text: '动态、喊单、Memestock 与关注', link: '/zh/protocol/social' },
            ],
          },
          {
            text: '个人主页与工具',
            collapsed: false,
            items: [
              { text: '个人主页与身份', link: '/zh/protocol/profiles' },
              { text: '投资组合面板', link: '/zh/protocol/portfolio' },
              { text: '创作者声誉', link: '/zh/protocol/reputation' },
              { text: '持有者分红与线性解锁', link: '/zh/protocol/dividends-and-vesting' },
              { text: 'PnL 卡片与分享', link: '/zh/protocol/pnl-cards' },
              { text: '价格与市值提醒', link: '/zh/protocol/price-alerts' },
              { text: '邀请好友与推荐', link: '/zh/protocol/referrals' },
            ],
          },
          {
            text: '网络与合约',
            collapsed: false,
            items: [
              { text: '网络配置 (Robinhood & Arc)', link: '/zh/integration/network' },
              { text: '已验证智能合约', link: '/zh/integration/contracts' },
              { text: '公开 API', link: '/zh/integration/api' },
              { text: 'AI 代理', link: '/zh/integration/agents' },
              { text: 'DEX 与聚合器上架', link: '/zh/integration/listing-submission' },
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
          { text: 'Cómo Lanzar', link: '/es/protocol/launches' },
          { text: 'Guía de Trading', link: '/es/protocol/trading-guide' },
          { text: 'FAQ', link: '/es/protocol/faq' },
          { text: 'Seguridad', link: '/es/protocol/anti-snipe' },
          { text: 'Ir a Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Guía del Usuario',
            collapsed: false,
            items: [
              { text: '¿Qué es Goton?', link: '/es/protocol/overview' },
              { text: 'Preguntas Frecuentes (FAQ)', link: '/es/protocol/faq' },
            ],
          },
          {
            text: 'Lanzamientos y Trading',
            collapsed: false,
            items: [
              { text: 'Cómo Lanzar un Token', link: '/es/protocol/launches' },
              { text: 'Guía de Trading y Swaps', link: '/es/protocol/trading-guide' },
              { text: 'Limit, Take-Profit y Stop-Loss', link: '/es/protocol/advanced-orders' },
              { text: 'Anti-Snipe y Lanzamiento Justo', link: '/es/protocol/anti-snipe' },
              { text: 'Analíticas del Protocolo', link: '/es/protocol/analytics' },
            ],
          },
          {
            text: 'Economía y Comunidad',
            collapsed: false,
            items: [
              { text: 'Tarifas y Recompensas del Creador', link: '/es/protocol/fees-and-burns' },
              { text: 'Community Takeovers (CTO)', link: '/es/protocol/community-takeovers' },
              { text: 'Feed, Calls, Memestock y Seguir', link: '/es/protocol/social' },
            ],
          },
          {
            text: 'Perfil y Herramientas',
            collapsed: false,
            items: [
              { text: 'Perfiles e Identidad', link: '/es/protocol/profiles' },
              { text: 'Panel de Portafolio', link: '/es/protocol/portfolio' },
              { text: 'Reputación del Creador', link: '/es/protocol/reputation' },
              {
                text: 'Dividendos de Holders y Vesting',
                link: '/es/protocol/dividends-and-vesting',
              },
              { text: 'Tarjetas PnL y Compartir', link: '/es/protocol/pnl-cards' },
              { text: 'Alertas de Precio y Market Cap', link: '/es/protocol/price-alerts' },
              { text: 'Invita Amigos y Referidos', link: '/es/protocol/referrals' },
            ],
          },
          {
            text: 'Red y Contratos',
            collapsed: true,
            items: [
              { text: 'Configuración de Red', link: '/integration/network' },
              { text: 'Contratos Verificados', link: '/integration/contracts' },
              { text: 'API Pública', link: '/integration/api' },
              { text: 'Para Agentes IA', link: '/integration/agents' },
              { text: 'Listado en DEX', link: '/integration/listing-submission' },
            ],
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
          { text: 'Lancer un Token', link: '/fr/protocol/launches' },
          { text: 'Guide de Trading', link: '/fr/protocol/trading-guide' },
          { text: 'FAQ', link: '/fr/protocol/faq' },
          { text: 'Sécurité', link: '/fr/protocol/anti-snipe' },
          { text: 'Application Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Guide Utilisateur',
            collapsed: false,
            items: [
              { text: 'Qu’est-ce que Goton ?', link: '/fr/protocol/overview' },
              { text: 'Foire Aux Questions (FAQ)', link: '/fr/protocol/faq' },
            ],
          },
          {
            text: 'Lancements et Trading',
            collapsed: false,
            items: [
              { text: 'Lancer un Token', link: '/fr/protocol/launches' },
              { text: 'Guide de Trading et de Swaps', link: '/fr/protocol/trading-guide' },
              { text: 'Limit, Take-Profit et Stop-Loss', link: '/fr/protocol/advanced-orders' },
              { text: 'Anti-Snipe et Lancement Équitable', link: '/fr/protocol/anti-snipe' },
              { text: 'Analyses du Protocole', link: '/fr/protocol/analytics' },
            ],
          },
          {
            text: 'Économie et Communauté',
            collapsed: false,
            items: [
              { text: 'Frais et Récompenses du Créateur', link: '/fr/protocol/fees-and-burns' },
              { text: 'Community Takeovers (CTO)', link: '/fr/protocol/community-takeovers' },
              { text: 'Feed, Calls, Memestock et Suivi', link: '/fr/protocol/social' },
            ],
          },
          {
            text: 'Profil et Outils',
            collapsed: false,
            items: [
              { text: 'Profils et Identité', link: '/fr/protocol/profiles' },
              { text: 'Tableau de Bord du Portefeuille', link: '/fr/protocol/portfolio' },
              { text: 'Réputation du Créateur', link: '/fr/protocol/reputation' },
              {
                text: 'Dividendes des Holders et Vesting',
                link: '/fr/protocol/dividends-and-vesting',
              },
              { text: 'Cartes PnL et Partage', link: '/fr/protocol/pnl-cards' },
              { text: 'Alertes de Prix et de Market Cap', link: '/fr/protocol/price-alerts' },
              { text: 'Inviter des Amis et Parrainage', link: '/fr/protocol/referrals' },
            ],
          },
          {
            text: 'Réseau et Contrats',
            collapsed: true,
            items: [
              { text: 'Configuration du Réseau', link: '/integration/network' },
              { text: 'Contrats Vérifiés', link: '/integration/contracts' },
              { text: 'API Publique', link: '/integration/api' },
              { text: 'Pour les Agents IA', link: '/integration/agents' },
              { text: 'Référencement DEX', link: '/integration/listing-submission' },
            ],
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
          { text: 'Token launchen', link: '/de/protocol/launches' },
          { text: 'Trading-Leitfaden', link: '/de/protocol/trading-guide' },
          { text: 'FAQ', link: '/de/protocol/faq' },
          { text: 'Sicherheit', link: '/de/protocol/anti-snipe' },
          { text: 'Launchpad App', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Benutzerhandbuch',
            collapsed: false,
            items: [
              { text: 'Was ist Goton?', link: '/de/protocol/overview' },
              { text: 'Häufig gestellte Fragen (FAQ)', link: '/de/protocol/faq' },
            ],
          },
          {
            text: 'Launches und Trading',
            collapsed: false,
            items: [
              { text: 'Einen Token launchen', link: '/de/protocol/launches' },
              { text: 'Trading- und Swap-Leitfaden', link: '/de/protocol/trading-guide' },
              { text: 'Limit, Take-Profit und Stop-Loss', link: '/de/protocol/advanced-orders' },
              { text: 'Anti-Snipe und Fair Launch', link: '/de/protocol/anti-snipe' },
              { text: 'Protokoll-Analytics', link: '/de/protocol/analytics' },
            ],
          },
          {
            text: 'Ökonomie und Community',
            collapsed: false,
            items: [
              { text: 'Creator-Gebühren und Belohnungen', link: '/de/protocol/fees-and-burns' },
              { text: 'Community Takeovers (CTO)', link: '/de/protocol/community-takeovers' },
              { text: 'Feed, Calls, Memestock und Folgen', link: '/de/protocol/social' },
            ],
          },
          {
            text: 'Profil und Werkzeuge',
            collapsed: false,
            items: [
              { text: 'Profile und Identität', link: '/de/protocol/profiles' },
              { text: 'Portfolio-Dashboard', link: '/de/protocol/portfolio' },
              { text: 'Creator-Reputation', link: '/de/protocol/reputation' },
              { text: 'Holder-Dividenden und Vesting', link: '/de/protocol/dividends-and-vesting' },
              { text: 'PnL-Karten und Teilen', link: '/de/protocol/pnl-cards' },
              {
                text: 'Preis- und Market-Cap-Benachrichtigungen',
                link: '/de/protocol/price-alerts',
              },
              { text: 'Freunde Einladen und Empfehlungen', link: '/de/protocol/referrals' },
            ],
          },
          {
            text: 'Netzwerk und Verträge',
            collapsed: true,
            items: [
              { text: 'Netzwerkkonfiguration', link: '/integration/network' },
              { text: 'Verifizierte Verträge', link: '/integration/contracts' },
              { text: 'Public API', link: '/integration/api' },
              { text: 'Für KI-Agenten', link: '/integration/agents' },
              { text: 'DEX-Listing', link: '/integration/listing-submission' },
            ],
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
          { text: 'Como Lançar', link: '/pt/protocol/launches' },
          { text: 'Guia de Trading', link: '/pt/protocol/trading-guide' },
          { text: 'FAQ', link: '/pt/protocol/faq' },
          { text: 'Segurança', link: '/pt/protocol/anti-snipe' },
          { text: 'App Launchpad', link: `${SITE.appUrl}` },
        ],
        sidebar: [
          {
            text: 'Manual do Usuário',
            collapsed: false,
            items: [
              { text: 'O que é o Goton?', link: '/pt/protocol/overview' },
              { text: 'Perguntas Frequentes (FAQ)', link: '/pt/protocol/faq' },
            ],
          },
          {
            text: 'Lançamentos e Trading',
            collapsed: false,
            items: [
              { text: 'Como Lançar um Token', link: '/pt/protocol/launches' },
              { text: 'Guia de Trading e Swaps', link: '/pt/protocol/trading-guide' },
              { text: 'Limit, Take-Profit e Stop-Loss', link: '/pt/protocol/advanced-orders' },
              { text: 'Anti-Snipe e Lançamento Justo', link: '/pt/protocol/anti-snipe' },
              { text: 'Análises do Protocolo', link: '/pt/protocol/analytics' },
            ],
          },
          {
            text: 'Economia e Comunidade',
            collapsed: false,
            items: [
              { text: 'Taxas e Recompensas do Criador', link: '/pt/protocol/fees-and-burns' },
              { text: 'Community Takeovers (CTO)', link: '/pt/protocol/community-takeovers' },
              { text: 'Feed, Calls, Memestock e Seguir', link: '/pt/protocol/social' },
            ],
          },
          {
            text: 'Perfil e Ferramentas',
            collapsed: false,
            items: [
              { text: 'Perfis e Identidade', link: '/pt/protocol/profiles' },
              { text: 'Painel de Portfólio', link: '/pt/protocol/portfolio' },
              { text: 'Reputação do Criador', link: '/pt/protocol/reputation' },
              {
                text: 'Dividendos de Holders e Vesting',
                link: '/pt/protocol/dividends-and-vesting',
              },
              { text: 'Cartões PnL e Compartilhamento', link: '/pt/protocol/pnl-cards' },
              { text: 'Alertas de Preço e Market Cap', link: '/pt/protocol/price-alerts' },
              { text: 'Convide Amigos e Indicações', link: '/pt/protocol/referrals' },
            ],
          },
          {
            text: 'Rede e Contratos',
            collapsed: true,
            items: [
              { text: 'Configuração de Rede', link: '/integration/network' },
              { text: 'Contratos Verificados', link: '/integration/contracts' },
              { text: 'API Pública', link: '/integration/api' },
              { text: 'Para Agentes de IA', link: '/integration/agents' },
              { text: 'Listagem em DEX', link: '/integration/listing-submission' },
            ],
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
