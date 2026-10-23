/**
 * Server-side SEO for the goton.fun single-page app: per-page meta tags (the SPA otherwise serves
 * one homepage title, description and canonical for every URL) and a sitemap with token pages.
 * Pure functions, so worker.ts stays thin and this stays testable.
 */

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
}

const SITE_TITLE = 'goton · Launch fixed-supply tokens on Robinhood Chain & Arc';
const SITE_DESCRIPTION =
  'goton is the non-custodial launchpad for fixed-supply tokens on Robinhood Chain and Arc. Launch on a bonding curve or straight into a locked Uniswap v4 pool, then trade, call and follow.';

/** Static pages listed in the sitemap, with how often they change. */
export const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'hourly', priority: '1.0' },
  { path: '/launchpad', changefreq: 'hourly', priority: '1.0' },
  { path: '/memestock', changefreq: 'hourly', priority: '0.8' },
  { path: '/feed', changefreq: 'hourly', priority: '0.8' },
  { path: '/analytics', changefreq: 'daily', priority: '0.6' },
  { path: '/launchpad/create', changefreq: 'monthly', priority: '0.7' },
];

const PAGE_TITLES: Record<string, [string, string]> = {
  '/launchpad': [
    'Explore tokens',
    'Every token launched on goton, with live market cap, volume and price since launch.',
  ],
  '/memestock': [
    'Memestock',
    'Launches with a written thesis whose creator still holds a position they bought, ranked by trading in the last hour.',
  ],
  '/feed': [
    'Feed',
    'Calls from holders on goton tokens: theses, targets and the share of supply each caller held.',
  ],
  '/analytics': [
    'Analytics',
    'Protocol volume, launches and deployed contracts on Robinhood Chain and Arc.',
  ],
  '/launchpad/create': [
    'Create a token',
    'Launch a fixed-supply token on Robinhood Chain or Arc with locked liquidity.',
  ],
};

/** USD as $4.1K / $2.30M. */
function usd(value: number): string {
  if (!(value > 0)) return '';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/** Collapse whitespace and cut to `max` characters on a word boundary. */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

/** An image a link preview can load: an https URL (IPFS hashes go through a public gateway). */
export function previewImage(logo: string | undefined, fallback: string): string {
  const l = (logo ?? '').trim();
  if (/^https:\/\//.test(l)) return l;
  if (/^ipfs:\/\//.test(l)) return `https://ipfs.io/ipfs/${l.slice('ipfs://'.length)}`;
  return fallback;
}

/** Meta for a path. `token` is the token behind /token/:address, when it could be loaded. */
export function pageMeta(origin: string, pathname: string, token?: SeoToken | null): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const defaultImage = `${origin}/opengraph-image.png`;
  const base: PageMeta = {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    canonical: `${origin}${path === '/' ? '' : path}`,
    image: defaultImage,
    card: 'summary_large_image',
  };

  if (token && /^\/token\/0x[a-fA-F0-9]{40}$/.test(path)) {
    const mc = usd(token.marketCapUsd ?? 0);
    const chain = token.chainName ? ` on ${token.chainName}` : '';
    const about = token.description?.trim()
      ? clip(token.description, 140)
      : `Trade ${token.name} ($${token.symbol})${chain} on goton.`;
    const image = previewImage(token.logo, defaultImage);
    return {
      ...base,
      // Canonical uses the lowercase address so mixed-case links do not split the page.
      canonical: `${origin}/token/${token.address.toLowerCase()}`,
      title: `${token.name} ($${token.symbol})${mc ? ` · ${mc} market cap` : ''} · goton`,
      description: about,
      image,
      card: image === defaultImage ? 'summary_large_image' : 'summary',
    };
  }

  const known = PAGE_TITLES[path];
  if (known) return { ...base, title: `${known[0]} · goton`, description: known[1] };
  return base;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replace one `<meta {attr}="{key}" content="…">` tag, whatever its line breaks. */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[:]/g, '\\:')}"\\s+content="[^"]*"\\s*/?>`,
    'i',
  );
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
