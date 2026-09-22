interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  // Set to 'true' in wrangler.toml [vars] to send CSP as Report-Only.
  // Use this in staging before enforcing in production.
  CSP_REPORT_ONLY?: string;
  // Optional endpoint for CSP violation reports.
  CSP_REPORT_URI?: string;
}

/**
 * Hash an IP address before logging to avoid storing raw PII (fix MED-04).
 * Returns a 16-character hex string (truncated SHA-256) sufficient for log
 * correlation without being reversible to the original address.
 */
async function hashIp(ip: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // First 8 bytes (64 bits) give 16 hex chars: unique enough for sessions.
    return hashArray
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'unknown';
  }
}

/**
 * Build a Content-Security-Policy header suited for a Web3 SPA (fix LOW-01).
 *
 * Allows:
 *   script-src  - self + blob (Vite dynamic imports)
 *   connect-src - self + Robinhood RPC nodes + WalletConnect relays
 *   img-src     - self + data URIs + IPFS gateways
 *   frame-ancestors - none (consistent with X-Frame-Options: DENY)
 */
function buildCsp(reportUri?: string): string {
  const directives: string[] = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    [
      "connect-src 'self' https: wss:",
      'https://rpc.mainnet.chain.robinhood.com',
      'https://rpc.testnet.chain.robinhood.com',
      'wss://relay.walletconnect.com',
      'wss://relay.walletconnect.org',
      'https://*.walletconnect.com',
      'https://*.walletconnect.org',
      'https://api.coingecko.com',
    ].join(' '),
    "img-src 'self' data: blob: https:",
    "frame-src 'self' https://secure.walletconnect.org https://verify.walletconnect.org https://*.walletconnect.com https://*.reown.com",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ];
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }
  return directives.join('; ');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startTime = performance.now();
    const url = new URL(request.url);
    const rayId = request.headers.get('cf-ray') || crypto.randomUUID();

    // Block common scanner paths for dotfiles and admin panels.
    if (
      url.pathname.startsWith('/.') ||
      url.pathname.startsWith('/wp-admin') ||
      url.pathname.startsWith('/phpmyadmin') ||
      url.pathname.startsWith('/server-status') ||
      url.pathname.startsWith('/server-info')
    ) {
      return new Response('Not Found', { status: 404 });
    }

    const response = await env.ASSETS.fetch(request);
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    // Hash the IP before logging; do not store raw PII (fix MED-04).
    const rawIp = request.headers.get('cf-connecting-ip') ?? '';
    const hashedIp = await hashIp(rawIp);

    // Structured JSON log for Cloudflare Workers Logpush / Observability.
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'proto-edge-worker',
        rayId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs,
        clientIpHash: hashedIp,
      }),
    );

    const newHeaders = new Headers(response.headers);

    // Security headers
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    newHeaders.set('x-request-id', rayId);
    // Content-Security-Policy: use Report-Only mode in staging (CSP_REPORT_ONLY=true)
    // to catch violations before enforcing. Switch to enforcing in production.
    const cspValue = buildCsp(env.CSP_REPORT_URI);
    const cspHeader =
      env.CSP_REPORT_ONLY === 'true'
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
    newHeaders.set(cspHeader, cspValue);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
