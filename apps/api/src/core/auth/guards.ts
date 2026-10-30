import crypto from 'crypto';
import { sessionAddressFromRequest } from './session';

/** Constant-time bearer token comparison, so the secret cannot be guessed from response timing. */
export function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * API-09: social actions must come from the wallet they are attributed to. Requires a session
 * token (POST /api/auth/session) for `userAddress`; tests may omit it, like signed comments.
 */
export function requireSocialSession(
  req: Request,
  userAddress: string,
  action: string,
  strict = false,
): { code: string; message: string; status: number } | null {
  const sessionAddress = sessionAddressFromRequest(req);
  // Tests may skip sessions on social routes; destructive routes (strict) never do.
  if (!sessionAddress && !strict && process.env.NODE_ENV === 'test') return null;
  if (!sessionAddress) {
    return {
      code: 'SESSION_REQUIRED',
      message: `Sign in with your wallet to ${action}`,
      status: 401,
    };
  }
  if (sessionAddress !== userAddress.toLowerCase()) {
    return {
      code: 'SESSION_MISMATCH',
      message: `Session wallet does not match the address used to ${action}`,
      status: 403,
    };
  }
  return null;
}
