import crypto from 'crypto';
import { SESSION_TTL_MS } from '@goton/shared-types';

/**
 * Stateless wallet sessions for social actions (API-09). A session token binds a wallet address
 * to an expiry with an HMAC, so endpoints can check who is acting without a signature per click.
 * Token format: base64url(`${address}.${expiresAt}`) + '.' + base64url(hmac).
 */
let cachedSecret: string | null = null;

function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!cachedSecret) {
    // Without a configured secret, sessions are valid only for this process lifetime.
    cachedSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[Session] SESSION_SECRET not set; using an ephemeral secret.');
  }
  return cachedSecret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(
  address: string,
  now = Date.now(),
): { token: string; expiresAt: number } {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = `${address.toLowerCase()}.${expiresAt}`;
  return { token: `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`, expiresAt };
}

/** Returns the session's wallet address (lowercase), or null if the token is invalid or expired. */
export function verifySessionToken(
  token: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!token) return null;
  const [encoded, mac] = token.split('.');
  if (!encoded || !mac) return null;
  const payload = Buffer.from(encoded, 'base64url').toString();
  const expected = sign(payload);
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  const [address, expiresAt] = payload.split('.');
  if (!/^0x[a-f0-9]{40}$/.test(address) || !(Number(expiresAt) > now)) return null;
  return address;
}

/** Wallet address of the request's `Authorization: Bearer <session>` header, if valid. */
export function sessionAddressFromRequest(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  return verifySessionToken(header.startsWith('Bearer ') ? header.slice(7).trim() : null);
}
