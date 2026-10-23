/**
 * Google Tag Manager and Google Analytics, loaded only after the visitor accepts the cookie banner (GRC-04) and only once
 * the browser is idle, so gtag.js (~175 KB) never competes with the first paint. Consent can be
 * withdrawn from the footer "Cookie settings" link: tracking stops and the _ga cookies are removed.
 */
export const COOKIE_CONSENT_KEY = 'proto_cookie_consent_accepted_v1';
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-WEG4HF874Z';
const GTM_CONTAINER_ID = import.meta.env.VITE_GTM_ID || 'GTM-5SS9JQGV';

export type CookieChoice = 'accepted' | 'declined' | null;

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

let loaded = false;

/** Stored choice: 'true' accepted, 'false' declined, nothing yet = ask. */
export function readCookieChoice(): CookieChoice {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (value === 'true') return 'accepted';
    if (value === 'false') return 'declined';
  } catch {
    // Storage blocked: ask again.
  }
  return null;
}

export function hasAnalyticsConsent(): boolean {
  return readCookieChoice() === 'accepted';
}

function whenIdle(task: () => void): void {
  const run = () =>
    'requestIdleCallback' in window
      ? window.requestIdleCallback(task, { timeout: 4000 })
      : setTimeout(task, 1500);
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

function addScript(src: string): void {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Injects gtag.js and the Tag Manager container once. Call only after consent. */
export function loadAnalytics(): void {
  if (loaded || typeof window === 'undefined' || (!GA_MEASUREMENT_ID && !GTM_CONTAINER_ID)) return;
  loaded = true;
  whenIdle(() => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js reads the arguments object, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied' });
    if (GTM_CONTAINER_ID) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      addScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`);
    }
    if (GA_MEASUREMENT_ID) {
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID);
      addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
    }
  });
}

export function enableAnalytics(): void {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return;
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  loadAnalytics();
}

/** Stops further hits from an already loaded gtag.js and deletes the Google Analytics cookies. */
export function disableAnalytics(): void {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return;
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });

  const host = window.location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    for (const domain of domains) {
      // A past Expires as well as Max-Age=0: some cookie stores treat Max-Age=0 as "expires now"
      // and keep the cookie for the rest of that millisecond.
      document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

/** Loads analytics on startup for visitors who already consented. */
export function initAnalytics(): void {
  if (typeof window !== 'undefined' && hasAnalyticsConsent()) loadAnalytics();
}
