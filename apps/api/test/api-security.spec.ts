import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../src/server';

/**
 * Security tests against the API's HTTP handler: headers, CORS, input limits, validation,
 * authentication of privileged and destructive routes, and injection-shaped input.
 */
const BASE = 'http://localhost:3001';
const ADDRESS = '0x1111111111111111111111111111111111111111';

const call = (path: string, init?: RequestInit) =>
  server.fetch(new Request(`${BASE}${path}`, init));
const postJson = (path: string, body: string, headers: Record<string, string> = {}) =>
  call(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

describe('security headers', () => {
  it('sends hardening headers on API responses', async () => {
    const res = await call('/api/tokens?limit=1');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});

describe('CORS', () => {
  it('does not reflect an untrusted origin', async () => {
    const res = await call('/api/tokens?limit=1', { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('allows any origin only on the public crawler endpoints', async () => {
    const res = await call('/dex/latest-block', { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('request body limits and parsing', () => {
  it('rejects oversized JSON bodies with 413', async () => {
    const big = JSON.stringify({ address: ADDRESS, padding: 'x'.repeat(10_000) });
    const res = await postJson('/api/auth/session', big);
    expect(res.status).toBe(413);
  });

  it('answers 413 on every JSON route, not only the session route', async () => {
    const big = JSON.stringify({ userAddress: ADDRESS, padding: 'x'.repeat(70_000) });
    for (const path of [
      '/api/comments/c1/like',
      '/api/comments/c1/repost',
      `/api/tokens/${ADDRESS}/sentiment`,
      '/api/security/evaluate',
    ]) {
      const res = await postJson(path, big);
      expect(res.status, path).toBe(413);
    }
    const profile = await call(`/api/profiles/${ADDRESS}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    expect(profile.status).toBe(413);
  });

  it('rejects malformed JSON without a server error', async () => {
    const res = await postJson('/api/auth/session', '{"address": ');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('input validation', () => {
  it('rejects a session request without a valid address and signature', async () => {
    for (const body of [
      {},
      { address: 'not-an-address', issuedAt: Date.now(), signature: '0x00' },
      { address: ADDRESS, issuedAt: 'yesterday', signature: '0x00' },
    ]) {
      const res = await postJson('/api/auth/session', JSON.stringify(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('rejects an expired or forged sign-in signature', async () => {
    const stale = await postJson(
      '/api/auth/session',
      JSON.stringify({ address: ADDRESS, issuedAt: Date.now() - 60 * 60_000, signature: '0x00' }),
    );
    expect(stale.status).toBe(401);
    const forged = await postJson(
      '/api/auth/session',
      JSON.stringify({ address: ADDRESS, issuedAt: Date.now(), signature: `0x${'ab'.repeat(65)}` }),
    );
    expect(forged.status).toBe(401);
  });

  it('never answers malformed token addresses with a server error', async () => {
    for (const bad of ['not-an-address', '0x123', `0x${'z'.repeat(40)}`, '%00', "1' OR '1'='1"]) {
      const res = await call(`/api/tokens/${encodeURIComponent(bad)}/holders`);
      expect(res.status, bad).toBeLessThan(500);
    }
  });

  it('treats injection-shaped search input as plain data', async () => {
    for (const q of ["'; DROP TABLE tokens; --", '<script>alert(1)</script>', '%27%20OR%201=1']) {
      const res = await call(`/api/tokens?search=${encodeURIComponent(q)}&limit=5`);
      expect(res.status, q).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    }
    // The table is still there afterwards.
    expect((await call('/api/tokens?limit=1')).status).toBe(200);
  });

  it('rejects creator profiles with script or data URLs', async () => {
    for (const avatarUrl of ['javascript:alert(1)', 'data:text/html,<script>1</script>']) {
      const res = await call(`/api/profiles/${ADDRESS}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'x', avatarUrl }),
      });
      expect(res.status, avatarUrl).toBe(400);
    }
  });
});

describe('path traversal', () => {
  it('serves IPFS content only for plain CIDs', async () => {
    for (const path of [
      '/api/ipfs/..%2F..%2Fetc%2Fpasswd',
      '/api/ipfs/../../package.json',
      '/api/ipfs/%2e%2e%2f%2e%2e%2fpackage.json',
    ]) {
      const res = await call(path);
      expect(res.status, path).not.toBe(200);
      expect(await res.text()).not.toContain('"dependencies"');
    }
  });
});

describe('privileged and destructive routes', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('keeps admin endpoints closed without ADMIN_SECRET and with a wrong token', async () => {
    delete process.env.ADMIN_SECRET;
    expect((await postJson('/api/admin/backfill', '{}')).status).toBe(403);

    process.env.ADMIN_SECRET = 'correct-secret-value-1234567890';
    const wrong = await postJson('/api/admin/backfill', '{}', { Authorization: 'Bearer nope' });
    expect(wrong.status).toBe(401);
  });

  it('requires the DevOps token when one is configured', async () => {
    process.env.DEVOPS_AUTH_TOKEN = 'devops-token-1234567890';
    expect((await call('/api/devops/metrics')).status).toBe(401);
    const ok = await call('/api/devops/metrics', {
      headers: { Authorization: 'Bearer devops-token-1234567890' },
    });
    expect(ok.status).toBe(200);
  });

  it('never erases user data without the wallet session, even in tests', async () => {
    const res = await call(`/api/users/${ADDRESS}/data`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
