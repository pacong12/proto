import { describe, expect, it } from 'vitest';
import worker, { maintenanceMode, type Env } from '../worker';

const ASSET_BODY = '<!doctype html><title>app</title>';

function makeEnv(vars: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response(ASSET_BODY, { status: 200 }) },
    ...vars,
  };
}

const get = (path: string, env: Env, headers: Record<string, string> = {}) =>
  worker.fetch(new Request(`https://goton.fun${path}`, { headers }), env);

describe('edge worker maintenance mode', () => {
  it('treats unknown or missing values as off', () => {
    expect(maintenanceMode(makeEnv())).toBe('off');
    expect(maintenanceMode(makeEnv({ MAINTENANCE_MODE: 'yes' }))).toBe('off');
    expect(maintenanceMode(makeEnv({ MAINTENANCE_MODE: ' FULL ' }))).toBe('full');
  });

  it('serves pages normally when off', async () => {
    const res = await get('/launchpad', makeEnv());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(ASSET_BODY);
  });

  it('reports the banner state without caching', async () => {
    const res = await get(
      '/site-status.json',
      makeEnv({ MAINTENANCE_MODE: 'banner', MAINTENANCE_MESSAGE: ' Upgrade at 14:00 UTC ' }),
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ maintenance: 'banner', message: 'Upgrade at 14:00 UTC' });
  });

  it('keeps pages up in banner mode', async () => {
    const res = await get('/launchpad', makeEnv({ MAINTENANCE_MODE: 'banner' }));
    expect(res.status).toBe(200);
  });

  it('answers every page with an escaped 503 page in full mode', async () => {
    const res = await get(
      '/token/0xabc',
      makeEnv({ MAINTENANCE_MODE: 'full', MAINTENANCE_MESSAGE: '<script>x</script>' }),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('1800');
    const html = await res.text();
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<script>x');
  });

  it('lets the bypass token through and remembers it in a cookie', async () => {
    const env = makeEnv({ MAINTENANCE_MODE: 'full', MAINTENANCE_BYPASS_TOKEN: 's3cret' });

    const wrong = await get('/launchpad?maintenance_bypass=nope', env);
    expect(wrong.status).toBe(503);

    const redirect = await get('/launchpad?maintenance_bypass=s3cret&x=1', env);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/launchpad?x=1');
    expect(redirect.headers.get('set-cookie')).toContain('maintenance_bypass=s3cret');
    expect(redirect.headers.get('set-cookie')).toContain('HttpOnly');

    const withCookie = await get('/launchpad', env, { cookie: 'a=1; maintenance_bypass=s3cret' });
    expect(withCookie.status).toBe(200);
  });

  it('never accepts an empty bypass token', async () => {
    const env = makeEnv({ MAINTENANCE_MODE: 'full', MAINTENANCE_BYPASS_TOKEN: '  ' });
    expect((await get('/?maintenance_bypass=', env)).status).toBe(503);
    expect((await get('/', env, { cookie: 'maintenance_bypass=' })).status).toBe(503);
  });
});

describe('edge worker indexing', () => {
  it('marks development workers noindex', async () => {
    const res = await get('/launchpad', makeEnv({ NOINDEX: 'true' }));
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('leaves production indexable', async () => {
    const res = await get('/launchpad', makeEnv());
    expect(res.headers.get('x-robots-tag')).toBeNull();
  });
});

describe('edge worker www redirect', () => {
  it('sends www to the apex with a permanent redirect, keeping path and query', async () => {
    const res = await worker.fetch(new Request('https://www.goton.fun/sitemap.xml?x=1'), makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://goton.fun/sitemap.xml?x=1');
  });

  it('serves the apex directly', async () => {
    expect((await get('/launchpad', makeEnv())).status).toBe(200);
  });
});

describe('edge worker dotfile guard', () => {
  it('serves /.well-known/security.txt', async () => {
    expect((await get('/.well-known/security.txt', makeEnv())).status).toBe(200);
  });

  it('still blocks other dotfiles', async () => {
    expect((await get('/.env', makeEnv())).status).toBe(404);
    expect((await get('/.git/config', makeEnv())).status).toBe(404);
  });
});

describe('edge worker legal redirects', () => {
  it('sends legal pages to the docs site with a permanent redirect', async () => {
    const res = await get('/terms', makeEnv());
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://docs.goton.fun/terms-of-service');
    expect((await get('/cookie-policy/', makeEnv())).headers.get('location')).toBe(
      'https://docs.goton.fun/cookie-policy',
    );
  });

  it('uses the docs URL of the environment', async () => {
    const res = await get(
      '/privacy',
      makeEnv({ DOCS_URL: 'https://proto-docs-dev.example.workers.dev/' }),
    );
    expect(res.headers.get('location')).toBe(
      'https://proto-docs-dev.example.workers.dev/privacy-policy',
    );
  });

  it('leaves other paths alone', async () => {
    expect((await get('/terms-and-more', makeEnv())).status).toBe(200);
  });
});

describe('edge worker caching', () => {
  const assetEnv = (contentType: string) =>
    makeEnv({
      ASSETS: {
        fetch: async () =>
          new Response('x', { status: 200, headers: { 'content-type': contentType } }),
      },
    });

  it('marks hashed build files immutable', async () => {
    const res = await get('/assets/index-abc123.js', assetEnv('text/javascript'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('revalidates HTML so a deploy shows up at once', async () => {
    const res = await get('/launchpad', assetEnv('text/html; charset=utf-8'));
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('sends the same security headers on every page', async () => {
    for (const path of ['/launchpad', '/memestock', '/assets/a.js']) {
      const res = await get(path, assetEnv('text/html'));
      expect(res.headers.get('strict-transport-security'), path).toContain('max-age=');
      expect(res.headers.get('content-security-policy'), path).toContain("frame-ancestors 'none'");
    }
  });
});
