import { isAddress } from '@goton/shared-types';
import { apiFetch } from './api-client';

const KEY = 'proto:referrer';

/**
 * Records the `?ref=<wallet>` of the landing URL (first-touch: an existing referrer is kept), so
 * the wallet that connects next can be attributed to it. A no-op without a valid address.
 */
export function captureReferral(search: string = window.location.search): void {
  try {
    const ref = new URLSearchParams(search).get('ref');
    if (ref && isAddress(ref) && !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, ref.toLowerCase());
    }
  } catch {
    // Storage or URL unavailable: no attribution, no crash.
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
  const referrer = storedReferrer();
  if (!referrer || !isAddress(referee) || referrer === referee.toLowerCase()) return;
  try {
    await apiFetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referee, referrer }),
    });
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
