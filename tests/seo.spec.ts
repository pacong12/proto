import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMeta, buildSitemap, pageMeta, previewImage } from '../seo';
import worker, { type Env } from '../worker';

const ORIGIN = 'https://goton.fun';
const TOKEN = '0xA5127018cc8c111b5138d5efbc9f5b14596fdf5b';

const INDEX = `<!doctype html><html><head>
<title>goton</title>
<meta name="title" content="goton" />
<meta name="description" content="home" />
<link rel="canonical" href="https://goton.fun" />
<meta property="og:url" content="https://goton.fun" />
<meta property="og:title" content="goton" />
<meta property="og:description" content="home" />
<meta property="og:image" content="https://goton.fun/opengraph-image.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="https://goton.fun" />
<meta name="twitter:title" content="goton" />
<meta name="twitter:description" content="home" />
<meta name="twitter:image" content="https://goton.fun/opengraph-image.png" />
</head><body></body></html>`;

const apiToken = {
  address: TOKEN.toLowerCase(),
  name: 'Moon',
  symbol: 'MOON',
  description: 'A <token> & a "thesis"',
  logo: 'ipfs://QmHash',
  createdAt: 1_791_916_442_657,
  pairedToken: '0x3600000000000000000000000000000000000000',
};

describe('seo pageMeta', () => {
  it('gives known pages their own title and canonical', () => {
    const meta = pageMeta(ORIGIN, '/memestock/');
    expect(meta.title).toBe('Memestock · goton');
    expect(meta.canonical).toBe(`${ORIGIN}/memestock`);
    expect(meta.card).toBe('summary_large_image');
  });

  it('uses the homepage meta for unknown pages', () => {
    expect(pageMeta(ORIGIN, '/').canonical).toBe(ORIGIN);
    expect(pageMeta(ORIGIN, '/nope').title).toContain('Launch fixed-supply tokens');
  });

  it('builds token meta with market cap, lowercase canonical and the logo', () => {
    const meta = pageMeta(ORIGIN, `/token/${TOKEN}`, {
      address: TOKEN,
      name: 'Moon',
      symbol: 'MOON',
      logo: 'ipfs://QmHash',
      marketCapUsd: 6686.67,
      chainName: 'Arc',
    });
    expect(meta.title).toBe('Moon ($MOON) · $6.7K market cap · goton');
    expect(meta.canonical).toBe(`${ORIGIN}/token/${TOKEN.toLowerCase()}`);
    expect(meta.description).toBe('Trade Moon ($MOON) on Arc on goton.');
    expect(meta.image).toBe('https://ipfs.io/ipfs/QmHash');
    expect(meta.card).toBe('summary');
  });

  it('only accepts https or ipfs images', () => {
    expect(previewImage('http://x/a.png', 'f')).toBe('f');
    expect(previewImage('data:image/png;base64,AA', 'f')).toBe('f');
    expect(previewImage('https://x/a.png', 'f')).toBe('https://x/a.png');
  });
});

describe('seo applyMeta', () => {
  it('rewrites every tag and escapes values', () => {
    const html = applyMeta(INDEX, {
      title: 'A "quoted" <title>',
      description: 'd & e',
      canonical: `${ORIGIN}/feed`,
      image: `${ORIGIN}/opengraph-image.png`,
      card: 'summary_large_image',
    });
    expect(html).toContain('<title>A &quot;quoted&quot; &lt;title&gt;</title>');
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/feed" />`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/feed" />`);
    expect(html).toContain('<meta name="twitter:description" content="d &amp; e" />');
    expect(html).toContain('og:image:width');
  });

  it('drops the default image size hints for a token logo', () => {
    const html = applyMeta(INDEX, {
      title: 't',
      description: 'd',
      canonical: ORIGIN,
      image: 'https://x/logo.png',
      card: 'summary',
    });
    expect(html).not.toContain('og:image:width');
    expect(html).not.toContain('og:image:type');
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
  });
});

describe('seo buildSitemap', () => {
  it('lists static pages and unique token pages', () => {
    const xml = buildSitemap(
      ORIGIN,
      [
        { address: TOKEN, name: 'a', symbol: 'A', createdAt: 1_700_000_000 },
        { address: TOKEN.toLowerCase(), name: 'a', symbol: 'A' },
        { address: 'not-an-address', name: 'b', symbol: 'B' },
      ],
      new Date('2026-10-23T00:00:00Z'),
    );
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/memestock</loc>`);
    expect(xml.match(/\/token\//g)).toHaveLength(1);
    expect(xml).toContain('<lastmod>2023-11-14T22:13:20.000Z</lastmod>');
    expect(xml).not.toContain('not-an-address');
  });
});

describe('edge worker SEO', () => {
  afterEach(() => vi.unstubAllGlobals());

  const env = (): Env => ({
    ASSETS: {
      fetch: async () =>
        new Response(INDEX, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    },
    BACKEND_API_URL: 'https://api.test',
  });

  it('serves token pages with their own meta', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: true,
        data: { token: apiToken, marketData: { marketCapUsd: 2_300_000 } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await worker.fetch(new Request(`${ORIGIN}/token/${TOKEN}`), env());
    const html = await res.text();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`https://api.test/api/tokens/${TOKEN}`);
    expect(html).toContain('<title>Moon ($MOON) · $2.30M market cap · goton</title>');
    expect(html).toContain('content="A &lt;token&gt; &amp; a &quot;thesis&quot;"');
    expect(html).toContain(`href="${ORIGIN}/token/${TOKEN.toLowerCase()}"`);
  });

  it('keeps the default meta when the API is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 502 })),
    );
    const res = await worker.fetch(new Request(`${ORIGIN}/token/${TOKEN}`), env());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(`<link rel="canonical" href="${ORIGIN}/token/${TOKEN}" />`);
  });

  it('builds the sitemap from the token list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: true, data: [{ token: apiToken }] })),
    );
    const res = await worker.fetch(new Request(`${ORIGIN}/sitemap.xml`), env());
    expect(res.headers.get('content-type')).toContain('application/xml');
    expect(await res.text()).toContain(`<loc>${ORIGIN}/token/${TOKEN.toLowerCase()}</loc>`);
  });

  it('falls back to the static sitemap when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 502 })),
    );
    const staticSitemap = '<urlset></urlset>';
    const res = await worker.fetch(new Request(`${ORIGIN}/sitemap.xml`), {
      ...env(),
      ASSETS: {
        fetch: async () =>
          new Response(staticSitemap, { headers: { 'content-type': 'application/xml' } }),
      },
    });
    expect(await res.text()).toBe(staticSitemap);
  });
});
