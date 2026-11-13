// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ posts: [] as unknown[], resolveTo: null as string | null }));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(async (path: string, opts?: { method?: string; body?: string }) => {
    if (opts?.method === 'POST') {
      api.posts.push(JSON.parse(opts.body ?? '{}'));
      return { success: true, data: { recorded: true } };
    }
    // GET /api/users/resolve?query=... — username → address lookup.
    if (path.startsWith('/api/users/resolve')) {
      return api.resolveTo
        ? { success: true, data: { address: api.resolveTo } }
        : { success: false, data: null };
    }
    return { success: true, data: { count: 3, referees: [] } };
  }),
}));

const REFERRER = '0x00000000000000000000000000000000000000a1';
const WALLET = '0x00000000000000000000000000000000000000b2';

const {
  captureReferral,
  storedReferrer,
  attributeReferral,
  fetchReferralStats,
  referralCode,
  withReferral,
} = await import('../src/lib/referral');

describe('referral', () => {
  beforeEach(() => {
    localStorage.clear();
    api.posts = [];
    api.resolveTo = null;
  });

  it('captures a valid ?ref address first-touch and ignores malformed refs', () => {
    captureReferral(`?ref=${REFERRER}`);
    expect(storedReferrer()).toBe(REFERRER.toLowerCase());
    // First-touch: a later ref does not overwrite.
    captureReferral('?ref=0x00000000000000000000000000000000000000c3');
    expect(storedReferrer()).toBe(REFERRER.toLowerCase());
    // A ref with illegal characters (spaces) names nobody.
    localStorage.clear();
    captureReferral('?ref=not a ref');
    expect(storedReferrer()).toBeNull();
  });

  it('captures a username/slug ref and resolves it to an address before attributing', async () => {
    captureReferral('?ref=aerobrassgriffin-79c8');
    expect(storedReferrer()).toBe('aerobrassgriffin-79c8');
    api.resolveTo = REFERRER;
    await attributeReferral(WALLET);
    expect(api.posts).toEqual([{ referee: WALLET, referrer: REFERRER.toLowerCase() }]);
    expect(storedReferrer()).toBeNull();
  });

  it('drops a username ref that resolves to nobody (and clears it)', async () => {
    captureReferral('?ref=ghost-0000');
    api.resolveTo = null; // 404 from resolver
    await attributeReferral(WALLET);
    expect(api.posts).toHaveLength(0);
    expect(storedReferrer()).toBeNull();
  });

  it('attributes an address ref to the wallet once, then clears it', async () => {
    captureReferral(`?ref=${REFERRER}`);
    await attributeReferral(WALLET);
    expect(api.posts).toEqual([{ referee: WALLET, referrer: REFERRER.toLowerCase() }]);
    expect(storedReferrer()).toBeNull();
    // A second call posts nothing (already cleared).
    await attributeReferral(WALLET);
    expect(api.posts).toHaveLength(1);
  });

  it('does not attribute a wallet to itself', async () => {
    captureReferral(`?ref=${WALLET}`);
    await attributeReferral(WALLET);
    expect(api.posts).toHaveLength(0);
  });

  it('builds a URL-safe referral link from a wallet (username slug)', () => {
    const code = referralCode(WALLET);
    expect(code).toBeTruthy();
    expect(code).toMatch(/^[a-z0-9-]+$/);
    expect(withReferral('https://goton.fun/', WALLET)).toBe(`https://goton.fun/?ref=${code}`);
    expect(withReferral('https://goton.fun/pnl/x?a=1', WALLET)).toBe(
      `https://goton.fun/pnl/x?a=1&ref=${code}`,
    );
    // No connected wallet: the URL is unchanged.
    expect(withReferral('https://goton.fun/', null)).toBe('https://goton.fun/');
  });

  it('reads a referrer’s stats', async () => {
    expect(await fetchReferralStats(REFERRER)).toEqual({ count: 3, referees: [] });
  });
});
