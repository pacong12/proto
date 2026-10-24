import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyContent,
  applyMeta,
  appRoute,
  buildSitemap,
  HOME_FAQ,
  pageContent,
  pageMeta,
  previewImage,
} from '../seo';
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

const DOCS = 'https://docs.goton.fun';
const SHELL = '<html><head><title>goton</title></head><body><div id="app"></div></body></html>';

/** The structured data a page carries, parsed back from its JSON-LD script. */
function jsonLdOf(html: string): { '@graph': Array<Record<string, unknown>> } {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  return JSON.parse(match![1]);
}

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

  it('gives aliases and mixed-case token links one canonical URL', () => {
    expect(pageMeta(ORIGIN, '/explore').canonical).toBe(`${ORIGIN}/launchpad`);
    expect(pageMeta(ORIGIN, '/explore').title).toBe('Explore tokens · goton');
    for (const alias of ['token', 'launchpad', 'trade']) {
      expect(pageMeta(ORIGIN, `/${alias}/${TOKEN}/`).canonical).toBe(
        `${ORIGIN}/token/${TOKEN.toLowerCase()}`,
      );
    }
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
    expect(meta.description).toBe(
      'Trade Moon ($MOON) on Arc on goton: price, chart, holders and live trades.',
    );
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

describe('seo appRoute', () => {
  it('mirrors the app router: redirects, token pages, pages and 404s', () => {
    expect(appRoute('/')).toEqual({ kind: 'redirect', to: '/launchpad' });
    expect(appRoute('/trade/')).toEqual({ kind: 'redirect', to: '/launchpad' });
    expect(appRoute(`/launchpad/${TOKEN}`)).toEqual({ kind: 'token', address: TOKEN });
    expect(appRoute('/token/not-an-address').kind).toBe('not-found');
    for (const page of [
      '/launchpad',
      '/explore',
      '/launchpad/create',
      '/memestock',
      '/feed/',
      '/analytics',
      '/post/abc123',
      '/u',
      '/u/0xabc',
      '/profile/alice',
      '/@alice',
      '/alice.eth',
    ]) {
      expect(appRoute(page).kind, page).toBe('page');
    }
    for (const missing of ['/no/such/page', '/assets/missing.js/x', '/token/0x12/extra']) {
      expect(appRoute(missing).kind, missing).toBe('not-found');
    }
  });

  it('handles long runs of slashes in linear time', () => {
    const started = performance.now();
    expect(appRoute(`/memestock${'/'.repeat(100_000)}`).kind).toBe('page');
    expect(pageMeta(ORIGIN, `/feed${'/'.repeat(100_000)}`).canonical).toBe(`${ORIGIN}/feed`);
    expect(appRoute('/'.repeat(100_000))).toEqual({ kind: 'redirect', to: '/launchpad' });
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe('seo pageContent', () => {
  it('gives the home page (/launchpad) an h1, FAQ text and FAQPage data', () => {
    const content = pageContent(ORIGIN, DOCS, '/launchpad', pageMeta(ORIGIN, '/launchpad'))!;
    expect(content.html).toContain('<h1>goton: launch fixed-supply tokens');
    for (const [question] of HOME_FAQ) expect(content.html).toContain(question);
    const graph = content.jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(graph.map((node) => node['@type'])).toEqual(['WebSite', 'CollectionPage', 'FAQPage']);
    expect(graph[2].mainEntity).toHaveLength(HOME_FAQ.length);
    expect(pageContent(ORIGIN, DOCS, '/explore', pageMeta(ORIGIN, '/explore'))?.html).toBe(
      content.html,
    );
  });

  it('gives static pages a breadcrumb and nothing to unknown routes', () => {
    const content = pageContent(ORIGIN, DOCS, '/memestock/', pageMeta(ORIGIN, '/memestock'))!;
    expect(content.html).toContain('<h1>Memestock: launches with a thesis</h1>');
    const graph = content.jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(graph[1]['@type']).toBe('BreadcrumbList');
    expect(
      pageContent(ORIGIN, DOCS, '/profile/0xabc', pageMeta(ORIGIN, '/profile/0xabc')),
    ).toBeNull();
  });

  it('lists the latest launches on Explore', () => {
    const listed = [{ address: TOKEN, name: 'Moon', symbol: 'MOON' }];
    const content = pageContent(
      ORIGIN,
      DOCS,
      '/launchpad',
      pageMeta(ORIGIN, '/launchpad'),
      null,
      listed,
    )!;
    expect(content.html).toContain(
      `href="${ORIGIN}/token/${TOKEN.toLowerCase()}">Moon ($MOON)</a>`,
    );
    const page = (content.jsonLd['@graph'] as Array<Record<string, unknown>>)[1];
    expect(page['@type']).toBe('CollectionPage');
    expect((page.mainEntity as { itemListElement: unknown[] }).itemListElement).toHaveLength(1);
  });

  it('describes a token with its facts, escaped, and only https links', () => {
    const token = {
      ...apiToken,
      chainName: 'Arc',
      marketCapUsd: 2_300_000,
      priceUsd: 0.0023,
      deployer: '0xED654C622F3FB49C6C81A5BAC091B015669DB799',
      socials: { twitter: 'https://x.com/moon', website: 'javascript:alert(1)', telegram: '' },
    };
    const meta = pageMeta(ORIGIN, `/token/${TOKEN}`, token);
    const content = pageContent(ORIGIN, DOCS, `/token/${TOKEN}`, meta, token)!;
    expect(content.html).toContain('<h1>Moon ($MOON)</h1>');
    expect(content.html).toContain('A &lt;token&gt; &amp; a &quot;thesis&quot;');
    expect(content.html).toContain(`<dd>${TOKEN.toLowerCase()}</dd>`);
    expect(content.html).toContain('<dd>$2.30M</dd>');
    expect(content.html).toContain('<dd>$0.00230</dd>');
    expect(content.html).toContain('https://explorer.arc.io/token/');
    expect(content.html).toContain('https://x.com/moon');
    expect(content.html).not.toContain('javascript:');
    const entity = (content.jsonLd['@graph'] as Array<Record<string, unknown>>)[1];
    expect(entity.identifier).toEqual({
      '@type': 'PropertyValue',
      propertyID: 'Arc contract address',
      value: TOKEN.toLowerCase(),
    });
    expect(entity.sameAs).toEqual([
      `https://explorer.arc.io/token/${TOKEN.toLowerCase()}`,
      'https://x.com/moon',
    ]);
  });

  it('keeps token text from closing the JSON-LD script', () => {
    const token = { ...apiToken, name: '</script><script>alert(1)</script>' };
    const meta = pageMeta(ORIGIN, `/token/${TOKEN}`, token);
    const html = applyContent(SHELL, pageContent(ORIGIN, DOCS, `/token/${TOKEN}`, meta, token));
    expect(html).not.toContain('<script>alert(1)');
    expect(html.match(/<script/g)).toHaveLength(1);
    const entity = jsonLdOf(html)['@graph'][1];
    expect(entity.name).toBe('</script><script>alert(1)</script> (MOON)');
  });

  it('fills the empty app shell and adds the JSON-LD to <head>', () => {
    const content = pageContent(ORIGIN, DOCS, '/feed', pageMeta(ORIGIN, '/feed'));
    const html = applyContent(SHELL, content);
    expect(html).toContain('<div id="app"><main class="seo-static"><nav aria-label="Breadcrumb">');
    expect(html.indexOf('application/ld+json')).toBeLessThan(html.indexOf('</head>'));
    expect(applyContent('<div id="root"></div>', content)).toBe('<div id="root"></div>');
    expect(applyContent(SHELL, null)).toBe(SHELL);
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
    expect(xml).not.toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${ORIGIN}/launchpad</loc>`);
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
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
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

  it('renders the token page text and structured data into the app shell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          data: { token: apiToken, marketData: { marketCapUsd: 2_300_000, isGraduated: true } },
        }),
      ),
    );
    const res = await worker.fetch(new Request(`${ORIGIN}/token/${TOKEN}`), {
      ...env(),
      ASSETS: {
        fetch: async () => new Response(SHELL, { headers: { 'content-type': 'text/html' } }),
      },
    });
    const html = await res.text();
    expect(html).toContain('<h1>Moon ($MOON)</h1>');
    expect(html).toContain('<dd>Trading in a locked Uniswap v4 pool</dd>');
    expect(jsonLdOf(html)['@graph'][1]['@id']).toBe(`${ORIGIN}/token/${TOKEN.toLowerCase()}#token`);
  });

  it('links the latest launches from Explore', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({ success: true, data: [{ token: apiToken }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await worker.fetch(new Request(`${ORIGIN}/launchpad`), {
      ...env(),
      ASSETS: {
        fetch: async () => new Response(SHELL, { headers: { 'content-type': 'text/html' } }),
      },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/api/tokens?limit=30');
    expect(await res.text()).toContain(
      `<a href="${ORIGIN}/token/${TOKEN.toLowerCase()}">Moon ($MOON)</a>`,
    );
  });

  it('keeps the default meta when the API is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 502 })),
    );
    const res = await worker.fetch(new Request(`${ORIGIN}/token/${TOKEN}`), env());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(
      `<link rel="canonical" href="${ORIGIN}/token/${TOKEN.toLowerCase()}" />`,
    );
  });

  it('answers unknown routes and missing tokens with a real 404', async () => {
    const fetchMock = vi.fn(async () => new Response('{"success":false}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    for (const path of ['/no/such/page', '/token/not-an-address', `/token/${TOKEN}`]) {
      const res = await worker.fetch(new Request(`${ORIGIN}${path}`), env());
      expect(res.status, path).toBe(404);
      expect(await res.text(), path).toContain('<meta name="robots" content="noindex" />');
    }
    // Only the well-formed address needed the API.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('redirects / and /trade to /launchpad like the app router', async () => {
    for (const path of ['/', '/trade', '/?ref=x']) {
      const res = await worker.fetch(new Request(`${ORIGIN}${path}`), env());
      expect(res.status, path).toBe(301);
      expect(res.headers.get('location'), path).toBe(
        `${ORIGIN}/launchpad${path.includes('?') ? '?ref=x' : ''}`,
      );
    }
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
