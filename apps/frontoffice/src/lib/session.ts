import { buildSessionSignMessage } from '@goton/shared-types';
import { apiFetch } from './api-client';
import { getWalletClient } from './viem-client';

interface StoredSession {
  token: string;
  expiresAt: number;
}

const KEY_PREFIX = 'proto:session:';
/** Refresh a little before expiry so an action never races the deadline. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

function readStored(address: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + address.toLowerCase());
    const parsed = raw ? (JSON.parse(raw) as StoredSession) : null;
    return parsed && parsed.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function store(address: string, session: StoredSession): void {
  try {
    localStorage.setItem(KEY_PREFIX + address.toLowerCase(), JSON.stringify(session));
  } catch {
    // Storage unavailable: the session simply is not reused.
  }
}

/**
 * Authorization header for social actions (likes, reposts, sentiment) as `address`.
 * Signs one sign-in message per 24h and reuses the resulting session token (API-09).
 */
export async function getSessionHeaders(address: string): Promise<Record<string, string>> {
  let session = readStored(address);
  if (!session) {
    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error('Connect your wallet to continue');
    const [account] = await walletClient.getAddresses();
    if (!account || account.toLowerCase() !== address.toLowerCase()) {
      throw new Error('Connected wallet does not match this account');
    }
    const issuedAt = Date.now();
    const signature = await walletClient.signMessage({
      account,
      message: buildSessionSignMessage({ address: account, issuedAt }),
    });
    const res = await apiFetch<{ success: boolean; data: StoredSession }>('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ address: account, issuedAt, signature }),
    });
    session = res.data;
    store(address, session);
  }
  return { Authorization: `Bearer ${session.token}` };
}
