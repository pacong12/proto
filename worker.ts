import { applyMeta, buildSitemap, pageMeta, type SeoToken } from './seo';

export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  // Set to 'true' in wrangler.toml [vars] to send CSP as Report-Only.
  // Use this in staging before enforcing in production.
  // Backend API URL on VPS (e.g. https://api.goton.cloud)
  BACKEND_API_URL?: string;
  // Set to 'true' in wrangler.toml [vars] to send CSP as Report-Only.
  // Use this in staging before enforcing in production.
  CSP_REPORT_ONLY?: string;
  // Optional endpoint for CSP violation reports.
  CSP_REPORT_URI?: string;
  // Maintenance switch, set in the Cloudflare dashboard (Settings > Variables) without a rebuild:
  //   off (default) | banner (site works, app shows a notice) | full (503 page for every visitor)
  MAINTENANCE_MODE?: string;
  // Optional text for the banner / maintenance page (plain text, HTML is escaped).
  MAINTENANCE_MESSAGE?: string;
  // Optional secret: open any page with ?maintenance_bypass=<token> to use the site during `full`.
  MAINTENANCE_BYPASS_TOKEN?: string;
  // 'true' on non-production workers (development) to keep them out of search results.
  NOINDEX?: string;
  // Docs origin for legal-page redirects (production https://docs.goton.fun).
  DOCS_URL?: string;
}

/** Legal documents are served by the docs site; old app paths redirect there permanently. */
const LEGAL_REDIRECTS: Record<string, string> = {
  '/terms-of-service': '/terms-of-service',
  '/terms': '/terms-of-service',
  '/privacy-policy': '/privacy-policy',
  '/privacy': '/privacy-policy',
  '/cookie-policy': '/cookie-policy',
  '/cookies': '/cookie-policy',
  '/cookie': '/cookie-policy',
};

export function legalRedirect(pathname: string, env: Env): Response | null {
  const target = LEGAL_REDIRECTS[pathname.replace(/\/$/, '') || '/'];
  if (!target) return null;
  let docs = env.DOCS_URL || 'https://docs.goton.fun';
  while (docs.endsWith('/')) docs = docs.slice(0, -1);
  return Response.redirect(`${docs}${target}`, 301);
}

type MaintenanceMode = 'off' | 'banner' | 'full';

const BYPASS_COOKIE = 'maintenance_bypass';
const DEFAULT_MAINTENANCE_MESSAGE =
  'We are performing scheduled maintenance. Trading and launches will be back shortly.';

export function maintenanceMode(env: Env): MaintenanceMode {
  const mode = (env.MAINTENANCE_MODE ?? '').trim().toLowerCase();
  return mode === 'banner' || mode === 'full' ? mode : 'off';
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function hasBypassCookie(request: Request, token: string): boolean {
  const cookies = request.headers.get('cookie') ?? '';
  return cookies.split(';').some((c) => c.trim() === `${BYPASS_COOKIE}=${token}`);
}

function maintenancePage(message: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Under maintenance</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<style>
  :root { color-scheme: light dark; --bg: #fafafa; --fg: #18181b; --muted: #71717a; --accent: #ec4899; }
  @media (prefers-color-scheme: dark) { :root { --bg: #09090b; --fg: #fafafa; --muted: #a1a1aa; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg);
    font-family: Poppins, -apple-system, system-ui, sans-serif; padding: 24px; box-sizing: border-box; }
  main { max-width: 32rem; text-align: center; }
  .code { font-size: 4rem; font-weight: 900; letter-spacing: -0.05em; color: var(--accent); margin: 0; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0; }
  p { color: var(--muted); line-height: 1.6; }
</style>
</head>
<body>
<main>
  <p class="code">503</p>
  <h1>Under maintenance</h1>
  <p>${escapeHtml(message)}</p>
  <p>Your funds are on-chain and unaffected. Please check back soon.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '1800',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
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
    // static.cloudflareinsights.com: Cloudflare Web Analytics beacon (cookie-free), injected by Cloudflare.
    // www.googletagmanager.com: Tag Manager and gtag.js, loaded only after cookie consent.
    "script-src 'self' 'unsafe-inline' blob: https://static.cloudflareinsights.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://fonts.reown.com data:",
    [
      "connect-src 'self' https: wss:",
      'https://rpc.mainnet.chain.robinhood.com',
      'https://rpc.mainnet.arc.io',
      'https://*.arc.io',
      'https://arc.drpc.org',
      'https://*.drpc.org',
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

    // Block common scanner paths for dotfiles and admin panels (/.well-known/ stays public:
    // security.txt and similar standard files live there).
    if (
      (url.pathname.startsWith('/.') && !url.pathname.startsWith('/.well-known/')) ||
      url.pathname.startsWith('/wp-admin') ||
      url.pathname.startsWith('/phpmyadmin') ||
      url.pathname.startsWith('/server-status') ||
      url.pathname.startsWith('/server-info')
    ) {
      return new Response('Not Found', { status: 404 });
    }

    const legal = legalRedirect(url.pathname, env);
    if (legal) return legal;

    // Maintenance state for the app banner; never cached so a dashboard change applies at once.
    const mode = maintenanceMode(env);
    if (url.pathname === '/site-status.json') {
      return new Response(
        JSON.stringify({
          maintenance: mode,
          message: mode === 'off' ? '' : (env.MAINTENANCE_MESSAGE ?? '').trim(),
        }),
        { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
      );
    }

    // Full maintenance: every page gets the 503 page, except for holders of the bypass token.
    // The API proxy below stays reachable for integrations and the team.
    const isApiPath =
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/dex/') ||
      url.pathname === '/health';
    if (mode === 'full' && !isApiPath && url.pathname !== '/favicon.svg') {
      const token = env.MAINTENANCE_BYPASS_TOKEN?.trim();
      if (token && url.searchParams.get(BYPASS_COOKIE) === token) {
        url.searchParams.delete(BYPASS_COOKIE);
        return new Response(null, {
          status: 302,
          headers: {
            Location: url.pathname + url.search,
            'Set-Cookie': `${BYPASS_COOKIE}=${token}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`,
            'Cache-Control': 'no-store',
          },
        });
      }
      if (!token || !hasBypassCookie(request, token)) {
        return maintenancePage(env.MAINTENANCE_MESSAGE?.trim() || DEFAULT_MAINTENANCE_MESSAGE);
      }
    }

    // Proxy API, DEX Screener, and health check endpoints directly to the VPS backend
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/dex/') ||
      url.pathname.startsWith('/api/v1/') ||
      url.pathname === '/health'
    ) {
      const backendBase = env.BACKEND_API_URL || 'https://api.goton.cloud';
      const targetUrl = new URL(url.pathname + url.search, backendBase);
      const forwardHeaders = new Headers(request.headers);
      forwardHeaders.set('x-forwarded-host', url.host);
      forwardHeaders.set('x-forwarded-proto', url.protocol.replace(':', ''));
      const rawClientIp = request.headers.get('cf-connecting-ip') ?? '';
      if (rawClientIp) {
        forwardHeaders.set('x-real-ip', rawClientIp);
        forwardHeaders.set('cf-connecting-ip', rawClientIp);
      }

      try {
        return await fetch(targetUrl.toString(), {
          method: request.method,
          headers: forwardHeaders,
          body: request.body,
          redirect: 'follow',
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'GATEWAY_ERROR',
              message: 'VPS Backend service unreachable: ' + (err as Error).message,
            },
            timestamp: Date.now(),
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    if (url.pathname === '/sitemap.xml' && request.method === 'GET') {
      const sitemap = await dynamicSitemap(url.origin, env);
      if (sitemap) return sitemap;
    }

    let response = await env.ASSETS.fetch(request);
    // The SPA ships one title, description and canonical for every URL; write the page's own.
    if (
      request.method === 'GET' &&
      response.status === 200 &&
      (response.headers.get('content-type') ?? '').includes('text/html')
    ) {
      response = await withPageMeta(response, url, env);
    }
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
    // Hashed build files never change; HTML must always be revalidated so deploys show up at once.
    if (url.pathname.startsWith('/assets/')) {
      newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if ((newHeaders.get('content-type') ?? '').includes('text/html')) {
      newHeaders.set('Cache-Control', 'no-cache');
    }
    if (env.NOINDEX === 'true') newHeaders.set('X-Robots-Tag', 'noindex, nofollow');
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

// ---------------------------------------------------------------------------
// SEO: per-page meta and a sitemap with token pages (see seo.ts)
// ---------------------------------------------------------------------------

const ARC_USDC = '0x3600000000000000000000000000000000000000';
const SEO_FETCH_TIMEOUT_MS = 1_500;

async function backendJson<T>(env: Env, path: string): Promise<T | null> {
  const base = env.BACKEND_API_URL || 'https://api.goton.cloud';
  try {
    const res = await fetch(new URL(path, base).toString(), {
      signal: AbortSignal.timeout(SEO_FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: T };
    return body?.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

interface ApiToken {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  logo?: string;
  createdAt?: number;
  pairedToken?: string;
}

function toSeoToken(token: ApiToken, marketCapUsd?: number): SeoToken {
  return {
    address: token.address,
    name: token.name,
    symbol: token.symbol,
    description: token.description,
    logo: token.logo,
    createdAt: token.createdAt,
    marketCapUsd,
    chainName: (token.pairedToken ?? '').toLowerCase() === ARC_USDC ? 'Arc' : 'Robinhood Chain',
  };
}

/** index.html with the page's own meta; the original response when anything fails. */
export async function withPageMeta(response: Response, url: URL, env: Env): Promise<Response> {
  try {
    const html = await response.clone().text();
    let token: SeoToken | null = null;
    const match = url.pathname.match(/^\/token\/(0x[a-fA-F0-9]{40})\/?$/);
    if (match) {
      const data = await backendJson<{ token: ApiToken; marketData?: { marketCapUsd?: number } }>(
        env,
        `/api/tokens/${match[1]}`,
      );
      if (data?.token) token = toSeoToken(data.token, data.marketData?.marketCapUsd);
    }
    const out = applyMeta(html, pageMeta(url.origin, url.pathname, token));
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(out, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response;
  }
}

/** Sitemap with every token page, or null to fall back to the static sitemap.xml. */
export async function dynamicSitemap(origin: string, env: Env): Promise<Response | null> {
  const tokens: SeoToken[] = [];
  for (let offset = 0; offset < 1_000; offset += 100) {
    const page = await backendJson<Array<{ token: ApiToken }>>(
      env,
      `/api/tokens?limit=100&offset=${offset}`,
    );
    if (!page) {
      if (offset === 0) return null;
      break;
    }
    tokens.push(...page.map((item) => toSeoToken(item.token)));
    if (page.length < 100) break;
  }
  return new Response(buildSitemap(origin, tokens), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
