import { isAddress } from '@goton/shared-types';
import { apiFetch } from './api-client';
import { getUserIdentity } from './username';

const KEY = 'proto:referrer';

// A ref is either a 0x address or an identity string (username slug / handle / name), matching the
// characters the username router accepts. Bounded so a junk query string can never be stored.
const REF_PATTERN = /^[a-z0-9_.#@-]{1,64}$/;

/**
 * Records the `?ref=<wallet-or-username>` of the landing URL (first-touch: an existing referrer is
 * kept), so the wallet that connects next can be attributed to it. The ref may be an address or a
 * username/slug (e.g. `aerobrassgriffin-79c8`), resolved to an address at attribution time. A
 * no-op for anything that is neither.
 */
export function captureReferral(search: string = window.location.search): void {
  try {
    const raw = new URLSearchParams(search).get('ref');
    if (!raw) return;
    const ref = raw.trim().toLowerCase();
    if ((isAddress(ref) || REF_PATTERN.test(ref)) && !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, ref);
    }
  } catch {
    // Storage or URL unavailable: no attribution, no crash.
  }
}

/**
 * The URL-safe referral code for a wallet: its username slug (e.g. `aerobrassgriffin-79c8`), which
 * both the client and `/api/users/resolve` map back to the address. Null for a missing/invalid
 * wallet.
 */
export function referralCode(wallet?: string | null): string | null {
  if (!wallet || !isAddress(wallet)) return null;
  return getUserIdentity(wallet).slug;
}

/**
 * Appends `?ref=<referralCode>` for a wallet to a share URL (first-touch referral), so links a user
 * shares credit them. Returns the URL unchanged when there is no connected wallet.
 */
export function withReferral(url: string, wallet?: string | null): string {
  const code = referralCode(wallet);
  if (!code) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}ref=${encodeURIComponent(code)}`;
}

/** Resolves a stored ref (address or username/slug/handle) to a wallet address, or null. */
async function resolveReferrerAddress(ref: string): Promise<string | null> {
  if (isAddress(ref)) return ref.toLowerCase();
  try {
    const res = await apiFetch<{ success: boolean; data?: { address?: string } }>(
      `/api/users/resolve?query=${encodeURIComponent(ref)}`,
    );
    const addr = res?.success ? res.data?.address : undefined;
    return addr && isAddress(addr) ? addr.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function storedReferrer(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function clearStoredReferrer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Attributes the connected wallet to the stored referrer, once. Clears the stored referrer after
 * so it is never posted again. A no-op when there is no referrer, or it is the wallet itself.
 */
export async function attributeReferral(referee: string): Promise<void> {
  const rawReferrer = storedReferrer();
  if (!rawReferrer || !isAddress(referee)) return;
  try {
    const referrer = await resolveReferrerAddress(rawReferrer);
    if (referrer && referrer !== referee.toLowerCase()) {
      await apiFetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referee, referrer }),
      });
    }
  } catch {
    // Non-blocking: the referral simply is not recorded.
  } finally {
    clearStoredReferrer();
  }
}

export interface ReferralStats {
  count: number;
  referees: Array<{ referee: string; createdAt: number }>;
}

export async function fetchReferralStats(referrer: string): Promise<ReferralStats> {
  try {
    const res = await apiFetch<{ success: boolean; data: ReferralStats }>(
      `/api/referrals?referrer=${referrer}`,
    );
    return res.success ? res.data : { count: 0, referees: [] };
  } catch {
    return { count: 0, referees: [] };
  }
}
