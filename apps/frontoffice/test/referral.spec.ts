// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ posts: [] as unknown[] }));
vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(async (path: string, opts?: { method?: string; body?: string }) => {
    if (opts?.method === 'POST') {
      api.posts.push(JSON.parse(opts.body ?? '{}'));
      return { success: true, data: { recorded: true } };
    }
    return { success: true, data: { count: 3, referees: [] } };
  }),
}));

const REFERRER = '0x00000000000000000000000000000000000000a1';
const WALLET = '0x00000000000000000000000000000000000000b2';

const { captureReferral, storedReferrer, attributeReferral, fetchReferralStats } = await import(
  '../src/lib/referral'
);

describe('referral', () => {
  beforeEach(() => {
    localStorage.clear();
    api.posts = [];
  });

  it('captures a valid ?ref address first-touch and ignores junk', () => {
    captureReferral(`?ref=${REFERRER}`);
    expect(storedReferrer()).toBe(REFERRER.toLowerCase());
    // First-touch: a later ref does not overwrite.
    captureReferral('?ref=0x00000000000000000000000000000000000000c3');
    expect(storedReferrer()).toBe(REFERRER.toLowerCase());
    localStorage.clear();
    captureReferral('?ref=not-an-address');
    expect(storedReferrer()).toBeNull();
  });

  it('attributes the wallet to the referrer once, then clears it', async () => {
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

  it('reads a referrer’s stats', async () => {
    expect(await fetchReferralStats(REFERRER)).toEqual({ count: 3, referees: [] });
  });
});
