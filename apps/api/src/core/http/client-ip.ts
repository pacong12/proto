/** Minimal view of Bun's server used to read the TCP peer address. */
export interface PeerAddressSource {
  requestIP?(req: Request): { address: string } | null;
}

/**
 * Resolves the client IP for rate limiting (API-03 / AUD-MED-03).
 * The TCP peer address is used by default, so every client gets its own quota and forged
 * headers are ignored. Proxy headers are honoured only with TRUST_PROXY=true, i.e. when the
 * origin is reachable exclusively through Cloudflare / a trusted reverse proxy.
 */
export function extractClientIp(req: Request, server?: PeerAddressSource): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded =
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return server?.requestIP?.(req)?.address ?? '127.0.0.1';
}
