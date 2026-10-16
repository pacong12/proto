import type { RouteLocationNormalized } from 'vue-router';
import { SITE } from './site';

export interface PageSeo {
  title?: string;
  description?: string;
  /** Exclude the page from search results (404, personal views). */
  noindex?: boolean;
}

declare module 'vue-router' {
  interface RouteMeta {
    seo?: PageSeo;
  }
}

const BRAND = 'goton';
export const DEFAULT_TITLE = `${BRAND} · Launch fixed-supply tokens on Robinhood & Arc Chain`;
export const DEFAULT_DESCRIPTION =
  'goton is the non-custodial launchpad for fixed-supply tokens on Robinhood Chain and Arc Network. Deploy pure bonding curves with automatic liquidity graduation.';

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Applies title, description, canonical URL and social tags for the current page. The canonical
 * URL always points at the production domain, so preview hosts never compete in search results.
 */
export function setPageSeo(path: string, seo: PageSeo = {}): void {
  if (typeof document === 'undefined') return;
  const title = seo.title ? `${seo.title} · ${BRAND}` : DEFAULT_TITLE;
  const description = seo.description ?? DEFAULT_DESCRIPTION;
  const url = `${SITE.appUrl}${path === '/' ? '' : path}`;

  document.title = title;
  setMeta('name', 'description', description);
  setMeta(
    'name',
    'robots',
    seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
  );
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:url', url);
  setCanonical(url);
}

/** Router hook: static pages declare `meta.seo`; dynamic pages refine it once data loads. */
export function applyRouteSeo(to: RouteLocationNormalized): void {
  setPageSeo(to.path, to.meta.seo);
}
