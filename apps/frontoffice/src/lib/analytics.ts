/**
 * Google Analytics, loaded only after the visitor accepts the cookie banner (GRC-04) and only once
 * the browser is idle, so gtag.js (~175 KB) never competes with the first paint.
 */
export const COOKIE_CONSENT_KEY = 'proto_cookie_consent_accepted_v1';
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-WEG4HF874Z';

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let loaded = false;

export function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

function whenIdle(task: () => void): void {
  const run = () =>
    'requestIdleCallback' in window
      ? window.requestIdleCallback(task, { timeout: 4000 })
      : setTimeout(task, 1500);
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/** Injects gtag.js once. Call only after consent. */
export function loadAnalytics(): void {
  if (loaded || typeof window === 'undefined' || !GA_MEASUREMENT_ID) return;
  loaded = true;
  whenIdle(() => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js reads the arguments object, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  });
}

/** Loads analytics on startup for visitors who already consented. */
export function initAnalytics(): void {
  if (typeof window !== 'undefined' && hasAnalyticsConsent()) loadAnalytics();
}
