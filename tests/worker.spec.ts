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
