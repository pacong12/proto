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
    // Workers preview domain: proto.<account>.workers.dev -> proto-docs.<account>.workers.dev
    if (hostname.endsWith('.workers.dev')) {
      return `${protocol}//${hostname.replace(/^proto\./, 'proto-docs.')}`;
    }
  }
  return SITE.docsUrl;
}
