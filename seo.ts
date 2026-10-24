/**
 * Server-side SEO for the goton.fun single-page app: per-page meta tags (the SPA otherwise serves
 * one homepage title, description and canonical for every URL) and a sitemap with token pages.
 * Pure functions, so worker.ts stays thin and this stays testable.
 */

import {
  canonicalPath,
  clipText,
  isAddress,
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_TITLE,
  SEO_PAGES,
  tokenSeoDescription,
  trimTrailingSlashes,
} from './packages/shared-types/src/constants/seo';

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute canonical URL of the page. */
  canonical: string;
  /** Absolute image URL for link previews. */
  image: string;
  /** Large summary card for the default artwork, small card for a square token logo. */
  card: 'summary_large_image' | 'summary';
}

export interface SeoToken {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  logo?: string;
  createdAt?: number;
  marketCapUsd?: number;
  chainName?: string;
  priceUsd?: number;
  volume24hUsd?: number;
  isGraduated?: boolean;
  deployer?: string;
  /** Project links from the launch form; empty values are skipped. */
  socials?: Record<string, string>;
}

/** Static pages listed in the sitemap, with how often they change. */
export const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/launchpad', changefreq: 'hourly', priority: '1.0' },
  { path: '/memestock', changefreq: 'hourly', priority: '0.8' },
  { path: '/feed', changefreq: 'hourly', priority: '0.8' },
  { path: '/analytics', changefreq: 'daily', priority: '0.6' },
  { path: '/launchpad/create', changefreq: 'monthly', priority: '0.7' },
];

/** USD as $4.1K / $2.30M. */
function usd(value: number): string {
  if (!(value > 0)) return '';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/** An image a link preview can load: an https URL (IPFS hashes go through a public gateway). */
export function previewImage(logo: string | undefined, fallback: string): string {
  const l = (logo ?? '').trim();
  if (/^https:\/\//.test(l)) return l;
  if (/^ipfs:\/\//.test(l)) return `https://ipfs.io/ipfs/${l.slice('ipfs://'.length)}`;
  return fallback;
}

/** How the edge answers an app URL; mirrors apps/frontoffice/src/router/index.ts. */
export type AppRoute =
  | { kind: 'redirect'; to: string }
  | { kind: 'token'; address: string }
  | { kind: 'page' }
  | { kind: 'not-found' };

const APP_PAGES = [
  /^\/(launchpad|explore|launchpad\/create|memestock|feed|analytics)$/,
  /^\/post\/[^/]+$/,
  /^\/(u|profile|user)(\/[^/]+)?$/,
  /^\/@[^/]*$/,
  // /:username profile slug (one path segment)
  /^\/[a-zA-Z0-9_#.-]+$/,
];

/**
 * Matches a path against the app's routes, so the edge can send real redirects and 404 statuses
 * instead of the SPA answering every URL with 200 (Google reads that as a soft 404). Token pages
 * need the API to tell whether the token exists.
 */
export function appRoute(pathname: string): AppRoute {
  const path = trimTrailingSlashes(pathname) || '/';
  if (path === '/' || path === '/trade') return { kind: 'redirect', to: '/launchpad' };
  const token = /^\/(?:token|launchpad|trade)\/([^/]+)$/.exec(path);
  if (token && path !== '/launchpad/create') {
    return isAddress(token[1]) ? { kind: 'token', address: token[1] } : { kind: 'not-found' };
  }
  return APP_PAGES.some((re) => re.test(path)) ? { kind: 'page' } : { kind: 'not-found' };
}

/** Meta for a path. `token` is the token behind /token/:address, when it could be loaded. */
export function pageMeta(origin: string, pathname: string, token?: SeoToken | null): PageMeta {
  // The app sets the same canonical after it renders (src/lib/seo.ts); both use canonicalPath.
  const path = canonicalPath(pathname);
  const defaultImage = `${origin}/opengraph-image.png`;
  const base: PageMeta = {
    title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION,
    canonical: `${origin}${path === '/' ? '' : path}`,
    image: defaultImage,
    card: 'summary_large_image',
  };

  if (token && /^\/token\/0x[a-fA-F0-9]{40}$/.test(path)) {
    const mc = usd(token.marketCapUsd ?? 0);
    const about = tokenSeoDescription(
      token.name,
      token.symbol,
      token.chainName ?? 'Robinhood Chain',
      token.description,
    );
    const image = previewImage(token.logo, defaultImage);
    return {
      ...base,
      canonical: `${origin}${path}`,
      title: `${token.name} ($${token.symbol})${mc ? ` · ${mc} market cap` : ''} · goton`,
      description: about,
      image,
      card: image === defaultImage ? 'summary_large_image' : 'summary',
    };
  }

  const known = SEO_PAGES[path];
  if (known) return { ...base, title: `${known.title} · goton`, description: known.description };
  return base;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replace one `<meta {attr}="{key}" content="…">` tag, whatever its line breaks. */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${escapeRegExp(key)}"\\s+content="[^"]*"\\s*/?>`, 'i');
  return html.replace(re, `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`);
}

/** Writes `meta` into the app's index.html: title, description, canonical, Open Graph, X. */
export function applyMeta(html: string, meta: PageMeta): string {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttr(meta.title)}</title>`);
  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`,
  );
  const pairs: Array<['name' | 'property', string, string]> = [
    ['name', 'title', meta.title],
    ['name', 'description', meta.description],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:url', meta.canonical],
    ['property', 'og:image', meta.image],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:url', meta.canonical],
    ['name', 'twitter:image', meta.image],
    ['name', 'twitter:card', meta.card],
  ];
  for (const [attr, key, value] of pairs) out = setMeta(out, attr, key, value);
  // Token logos are not 1200x630 PNGs; drop the default image's type and size hints for them.
  if (meta.card === 'summary') {
    out = out.replace(
      /\s*<meta\s+property="og:image:(type|width|height)"\s+content="[^"]*"\s*\/?>/gi,
      '',
    );
  }
  return out;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Sitemap with the static pages and one entry per token page. */
export function buildSitemap(origin: string, tokens: SeoToken[], now = new Date()): string {
  const today = now.toISOString();
  const urls = STATIC_PAGES.map(
    (p) =>
      `  <url>\n    <loc>${xmlEscape(`${origin}${p.path === '/' ? '/' : p.path}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
  );
  const seen = new Set<string>();
  for (const t of tokens) {
    const address = t.address.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address) || seen.has(address)) continue;
    seen.add(address);
    const lastmod =
      t.createdAt && t.createdAt > 0
        ? new Date(t.createdAt < 1e12 ? t.createdAt * 1000 : t.createdAt).toISOString()
        : today;
    urls.push(
      `  <url>\n    <loc>${xmlEscape(`${origin}/token/${address}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Questions answered on the homepage, as text and as FAQPage data. Facts match the docs FAQ. */
export const HOME_FAQ: Array<[string, string]> = [
  [
    'What is goton?',
    'goton is a non-custodial launchpad for fixed-supply tokens on Robinhood Chain (chain ID 4663) and Arc (chain ID 5042). Anyone can launch a token, trade it, place limit, take-profit and stop-loss orders, and post calls on tokens they hold.',
  ],
  [
    'How does a token launch on goton?',
    'On Robinhood Chain a token starts on a bonding curve and moves into a locked Uniswap v4 pool once the curve raises 4.2 ETH. On Arc a token trades in a locked Uniswap v4 pool paired with USDC from launch.',
  ],
  [
    'How many tokens does a goton launch create?',
    'Every token has a fixed supply of 1,000,000,000 with 18 decimals. The contract has no mint function, so the supply can never grow.',
  ],
  [
    'Can a creator remove the liquidity?',
    'No. Liquidity is locked permanently in the Uniswap v4 pool. There is no unlock function or admin withdrawal key.',
  ],
  [
    'How much does it cost to launch a token?',
    'The launch fee is 0.0005 ETH on Robinhood Chain. On Arc there is no fee, with a minimum initial buy of 4.50 USDC.',
  ],
  [
    'How do token creators earn?',
    "Each token's trading fees and tax are split on-chain: 70% goes to the creator's share on Robinhood Chain and 80% on Arc. The creator can share it with holders, a buyback and burn, or a team of wallets.",
  ],
  [
    'Does goton hold my funds?',
    'No. goton is non-custodial: trades go from your own wallet to the verified contracts, and the app never holds a key or a balance for you.',
  ],
];

interface StaticPageCopy {
  /** Visible heading. */
  h1: string;
  /** Paragraphs of plain text. */
  body: string[];
  /** Breadcrumb label; the homepage has none. */
  crumb?: string;
}

const PAGE_COPY: Record<string, StaticPageCopy> = {
  // The app's home: / redirects here (worker.ts, as the router does).
  '/launchpad': {
    h1: 'goton: launch fixed-supply tokens on Robinhood Chain and Arc',
    body: [
      'goton is a non-custodial launchpad for fixed-supply tokens on Robinhood Chain and Arc. Every token has a supply of 1,000,000,000, no mint function and liquidity locked for good.',
      'Launch on a bonding curve that graduates into a locked Uniswap v4 pool, or straight into a Uniswap v4 pool paired with USDC on Arc. Trade with live charts, place limit, take-profit and stop-loss orders, post calls on tokens you hold and follow other callers.',
      'Explore lists every token launched on goton, with live market cap, 24 hour volume and price since launch. Tokens on Robinhood Chain trade on a bonding curve until it raises 4.2 ETH, then in a locked Uniswap v4 pool; tokens on Arc trade in a locked Uniswap v4 pool paired with USDC from launch.',
    ],
  },
  '/memestock': {
    h1: 'Memestock: launches with a thesis',
    crumb: 'Memestock',
    body: [
      'Memestock lists only launches with a written thesis whose creator bought a position and still holds most of it, ranked by trading in the last hour. Explore lists every token.',
    ],
  },
  '/feed': {
    h1: 'Feed: calls from token holders',
    crumb: 'Feed',
    body: [
      'Calls are short theses that holders post on goton tokens, with a target and the share of supply the caller held when posting. The Feed also shows Alpha Radar and the top movers.',
    ],
  },
  '/analytics': {
    h1: 'goton analytics',
    crumb: 'Analytics',
    body: [
      'Protocol-wide volume, launches and deployed contracts on Robinhood Chain and Arc, read from the chains by the goton indexer.',
    ],
  },
  '/launchpad/create': {
    h1: 'Create a token on goton',
    crumb: 'Create',
    body: [
      'Launch a token with a fixed supply of 1,000,000,000 and permanently locked liquidity. The fee is 0.0005 ETH on Robinhood Chain; Arc has no fee and a minimum initial buy of 4.50 USDC.',
      "Creators keep 70% of each token's fees and tax on Robinhood Chain and 80% on Arc, and can share it with holders, a buyback and burn, or a team of wallets.",
    ],
  },
};

const EXPLORERS: Record<string, string> = {
  'Robinhood Chain': 'https://robinhoodchain.blockscout.com',
  Arc: 'https://explorer.arc.io',
};

/** Content and structured data for one page, rendered into the app shell for crawlers. */
export interface PageContent {
  /** Plain HTML for inside #app; the Vue app replaces it when it mounts. */
  html: string;
  jsonLd: Record<string, unknown>;
}

const esc = escapeAttr;

/** A token listed on the Explore page. */
export interface ListedToken {
  address: string;
  name: string;
  symbol: string;
}

function date(ms?: number): string {
  if (!ms || ms <= 0) return '';
  return new Date(ms < 1e12 ? ms * 1000 : ms).toISOString().slice(0, 10);
}

function price(value?: number): string {
  if (!(value && value > 0)) return '';
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3)}`;
}

function nav(origin: string, docsUrl: string): string {
  const links: Array<[string, string]> = [
    [`${origin}/launchpad`, 'Explore tokens'],
    [`${origin}/memestock`, 'Memestock'],
    [`${origin}/feed`, 'Feed'],
    [`${origin}/launchpad/create`, 'Create a token'],
    [`${docsUrl}/`, 'Documentation'],
    [`${docsUrl}/protocol/faq`, 'FAQ'],
  ];
  return `<nav aria-label="goton"><ul>${links
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join('')}</ul></nav>`;
}

function breadcrumbs(items: Array<[string, string]>): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item,
    })),
  };
}

/**
 * Crawler-readable content for a page: an h1, the facts a person would read on it, and links.
 * Returns null for paths without one (profiles, unknown routes), which keep the plain shell.
 */
export function pageContent(
  origin: string,
  docsUrl: string,
  pathname: string,
  meta: PageMeta,
  token?: SeoToken | null,
  listed: ListedToken[] = [],
): PageContent | null {
  const path = canonicalPath(pathname);
  const docs = trimTrailingSlashes(docsUrl);
  const webPage = {
    '@type': 'WebPage',
    '@id': `${meta.canonical}#webpage`,
    url: meta.canonical,
    name: meta.title,
    description: meta.description,
    inLanguage: 'en',
    isPartOf: { '@id': `${origin}/#website` },
    publisher: { '@id': `${origin}/#organization` },
  };

  if (token && /^\/token\/0x[a-fA-F0-9]{40}$/.test(path)) {
    const address = token.address.toLowerCase();
    const chain = token.chainName ?? 'Robinhood Chain';
    const explorer = EXPLORERS[chain];
    const status = token.isGraduated
      ? 'Trading in a locked Uniswap v4 pool'
      : chain === 'Arc'
        ? 'Trading in a locked Uniswap v4 pool paired with USDC'
        : 'Trading on the bonding curve';
    const facts: Array<[string, string]> = [
      ['Chain', chain],
      ['Contract address', address],
      ['Status', status],
      ['Market cap', usd(token.marketCapUsd ?? 0)],
      ['Price', price(token.priceUsd)],
      ['24h volume', usd(token.volume24hUsd ?? 0)],
      ['Total supply', '1,000,000,000 (fixed, no mint function)'],
      ['Launched', date(token.createdAt)],
      ['Creator', token.deployer?.toLowerCase() ?? ''],
    ].filter((fact): fact is [string, string] => Boolean(fact[1]));
    const links: Array<[string, string]> = [];
    if (explorer)
      links.push([`${explorer}/token/${address}`, `View ${token.symbol} on the explorer`]);
    for (const [kind, url] of Object.entries(token.socials ?? {})) {
      if (/^https:\/\/[^\s"<>]+$/.test(url)) links.push([url, `${token.name} on ${kind}`]);
    }
    links.push([`${docs}/protocol/trading-guide`, 'How to trade on goton']);
    const description = token.description?.trim() ? clipText(token.description, 600) : '';
    const html = [
      `<nav aria-label="Breadcrumb"><a href="${esc(origin)}/launchpad">goton</a> › ${esc(token.name)}</nav>`,
      `<h1>${esc(token.name)} ($${esc(token.symbol)})</h1>`,
      `<p>${esc(token.name)} ($${esc(token.symbol)}) is a fixed-supply token launched on goton on ${esc(chain)}.</p>`,
      description ? `<p>${esc(description)}</p>` : '',
      `<dl>${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`,
      `<ul>${links.map(([href, label]) => `<li><a href="${esc(href)}" rel="nofollow noopener">${esc(label)}</a></li>`).join('')}</ul>`,
      nav(origin, docs),
    ].join('');
    const sameAs = links.filter(([href]) => !href.startsWith(docs)).map(([href]) => href);
    return {
      html,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            ...webPage,
            ...(token.createdAt
              ? {
                  datePublished: new Date(
                    token.createdAt < 1e12 ? token.createdAt * 1000 : token.createdAt,
                  ).toISOString(),
                }
              : {}),
            mainEntity: { '@id': `${meta.canonical}#token` },
            breadcrumb: { '@id': `${meta.canonical}#breadcrumb` },
          },
          {
            '@type': 'Thing',
            '@id': `${meta.canonical}#token`,
            name: `${token.name} (${token.symbol})`,
            alternateName: token.symbol,
            description:
              description ||
              `${token.name} ($${token.symbol}) is a fixed-supply token launched on goton on ${chain}.`,
            url: meta.canonical,
            ...(meta.image !== `${origin}/opengraph-image.png` ? { image: meta.image } : {}),
            identifier: {
              '@type': 'PropertyValue',
              propertyID: `${chain} contract address`,
              value: address,
            },
            ...(sameAs.length ? { sameAs } : {}),
          },
          {
            ...breadcrumbs([
              ['goton', `${origin}/launchpad`],
              [token.name, meta.canonical],
            ]),
            '@id': `${meta.canonical}#breadcrumb`,
          },
        ],
      },
    };
  }

  const copy = PAGE_COPY[path];
  if (!copy) return null;
  const parts = [
    copy.crumb
      ? `<nav aria-label="Breadcrumb"><a href="${esc(origin)}/launchpad">goton</a> › ${esc(copy.crumb)}</nav>`
      : '',
    `<h1>${esc(copy.h1)}</h1>`,
    ...copy.body.map((p) => `<p>${esc(p)}</p>`),
  ];
  const graph: Array<Record<string, unknown>> = [];

  if (path === '/launchpad') {
    if (listed.length) {
      parts.push(
        '<h2>Latest launches</h2>',
        `<ul>${listed
          .map(
            (t) =>
              `<li><a href="${esc(origin)}/token/${esc(t.address.toLowerCase())}">${esc(t.name)} ($${esc(t.symbol)})</a></li>`,
          )
          .join('')}</ul>`,
      );
    }
    parts.push(
      '<h2>Frequently asked questions</h2>',
      HOME_FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join(''),
    );
    graph.push(
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: 'goton',
        description: SEO_DEFAULT_DESCRIPTION,
        inLanguage: 'en',
        publisher: { '@id': `${origin}/#organization` },
      },
      {
        ...webPage,
        '@type': 'CollectionPage',
        ...(listed.length
          ? {
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: listed.map((t, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  name: `${t.name} (${t.symbol})`,
                  url: `${origin}/token/${t.address.toLowerCase()}`,
                })),
              },
            }
          : {}),
      },
      {
        '@type': 'FAQPage',
        '@id': `${meta.canonical}#faq`,
        url: meta.canonical,
        inLanguage: 'en',
        mainEntity: HOME_FAQ.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    );
  } else {
    graph.push(
      { ...webPage, breadcrumb: { '@id': `${meta.canonical}#breadcrumb` } },
      {
        ...breadcrumbs([
          ['goton', `${origin}/launchpad`],
          [copy.crumb ?? copy.h1, meta.canonical],
        ]),
        '@id': `${meta.canonical}#breadcrumb`,
      },
    );
  }
  parts.push(nav(origin, docs));
  return { html: parts.join(''), jsonLd: { '@context': 'https://schema.org', '@graph': graph } };
}

/** JSON for a <script> element: `<` is escaped so text from token names cannot close the tag. */
function scriptJson(value: unknown): string {
  // U+2028/U+2029 are valid in JSON but end a line in older JavaScript parsers.
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/[\u2028\u2029]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16)}`);
}

/** Puts `content` inside the empty #app element and its structured data in <head>. */
export function applyContent(html: string, content: PageContent | null): string {
  if (!content) return html;
  const shell = /<div id="app"><\/div>/;
  if (!shell.test(html)) return html;
  return html
    .replace(shell, `<div id="app"><main class="seo-static">${content.html}</main></div>`)
    .replace(
      /<\/head>/i,
      `<script type="application/ld+json">${scriptJson(content.jsonLd)}</script>\n</head>`,
    );
}
