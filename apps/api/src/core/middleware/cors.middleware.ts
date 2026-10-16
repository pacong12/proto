export function resolveCorsOrigin(
  pathname: string,
  requestOrigin: string,
  allowedOrigins: string[] = [],
  isProduction: boolean = process.env.NODE_ENV === 'production',
): string {
  const isPublicCrawlerPath = pathname.startsWith('/dex/') || pathname.startsWith('/api/v1/');
  if (isPublicCrawlerPath) {
    return '*';
  }

  const isLocalhost =
    requestOrigin.startsWith('http://localhost:') ||
    requestOrigin.startsWith('http://127.0.0.1:') ||
    requestOrigin.startsWith('http://[::1]:');

  if (!isProduction && isLocalhost) {
    return requestOrigin;
  }

  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : '';
  }

  if (isLocalhost) {
    return requestOrigin;
  }

  return '';
}

export function buildSecurityHeaders(corsOrigin: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}
