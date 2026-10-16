import { resolveSiteUrls } from '@goton/shared-types';

/**
 * Public URLs of this deployment. vite.config.ts always defines VITE_APP_URL / VITE_DOCS_URL
 * (defaulting to goton.fun / docs.goton.fun), so these are the canonical production URLs.
 */
export const SITE = resolveSiteUrls({
  appUrl: import.meta.env.VITE_APP_URL,
  docsUrl: import.meta.env.VITE_DOCS_URL,
});

/**
 * Docs URL for links in the running app. Local dev and *.workers.dev previews point at their own
 * docs deployment; everything else uses the configured docs URL.
 */
export function resolveDocsUrl(location: Location | undefined = globalThis.location): string {
  if (location) {
    const { hostname, port, protocol } = location;
    // In local dev, frontoffice is on 3010 and docs is on 3002.
    if (port === '3010' || hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3002`;
    }
    // workers.dev: proto.<account> -> proto-docs.<account>, proto-dev.<account> -> proto-docs-dev.<account>
    if (hostname.endsWith('.workers.dev')) {
      return `${protocol}//${hostname.replace(/^proto(-dev)?\./, 'proto-docs$1.')}`;
    }
  }
  return SITE.docsUrl;
}

export type LegalPage = 'terms-of-service' | 'privacy-policy' | 'cookie-policy';

/** Docs locales with translated legal pages; other languages get the English page. */
const LEGAL_LOCALES = new Set(['id', 'zh']);

/** Legal documents live on the docs site (single source); the app links there. */
export function legalUrl(page: LegalPage, locale?: string): string {
  const prefix = locale && LEGAL_LOCALES.has(locale) ? `/${locale}` : '';
  return `${resolveDocsUrl()}${prefix}/${page}`;
}
