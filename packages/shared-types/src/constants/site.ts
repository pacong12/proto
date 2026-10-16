/**
 * Public site URLs. The defaults are the production domains; every app reads its URLs through
 * `resolveSiteUrls` so a deployment can point elsewhere with VITE_APP_URL / VITE_DOCS_URL alone.
 */
export const DEFAULT_APP_URL = 'https://goton.fun';
export const DEFAULT_DOCS_URL = 'https://docs.goton.fun';

export interface SiteUrls {
  /** Frontoffice origin, no trailing slash (e.g. https://goton.fun). */
  appUrl: string;
  /** Host shown to users (e.g. goton.fun). */
  appHost: string;
  /** Docs origin, no trailing slash (e.g. https://docs.goton.fun). */
  docsUrl: string;
  /** Docs host (e.g. docs.goton.fun). */
  docsHost: string;
}

const trimSlash = (url: string): string => url.trim().replace(/\/+$/, '');

export function resolveSiteUrls(env: { appUrl?: string; docsUrl?: string } = {}): SiteUrls {
  const appUrl = trimSlash(env.appUrl || DEFAULT_APP_URL);
  const docsUrl = trimSlash(env.docsUrl || DEFAULT_DOCS_URL);
  return { appUrl, appHost: new URL(appUrl).host, docsUrl, docsHost: new URL(docsUrl).host };
}

/**
 * Placeholders used in static files that cannot read env vars at runtime (robots.txt, sitemap.xml,
 * llms.txt, Open Graph images, docs markdown). Build steps replace them with the resolved URLs.
 */
export function renderSiteUrls(text: string, urls: SiteUrls): string {
  return text
    .replaceAll('%APP_URL%', urls.appUrl)
    .replaceAll('%APP_HOST%', urls.appHost)
    .replaceAll('%DOCS_URL%', urls.docsUrl)
    .replaceAll('%DOCS_HOST%', urls.docsHost);
}
