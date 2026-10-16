// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('../src/lib/analytics');
}
const gtagScripts = () =>
  Array.from(document.head.querySelectorAll('script')).filter((s) =>
    s.src.includes('googletagmanager'),
  );

describe('analytics consent gate', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    localStorage.clear();
    // Run idle callbacks immediately and pretend the page has loaded.
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
      return 1;
    });
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    // Assert on the injected <script> without fetching gtag.js from the network.
    const settings = (
      window as unknown as {
        happyDOM: {
          settings: {
            disableJavaScriptFileLoading: boolean;
            handleDisabledFileLoadingAsSuccess: boolean;
          };
        };
      }
    ).happyDOM.settings;
    settings.disableJavaScriptFileLoading = true;
    settings.handleDisabledFileLoadingAsSuccess = true;
  });

  it('does nothing without consent', async () => {
    const { initAnalytics, hasAnalyticsConsent } = await freshModule();
    expect(hasAnalyticsConsent()).toBe(false);
    initAnalytics();
    expect(gtagScripts()).toHaveLength(0);
  });

  it('loads gtag.js once for visitors who consented', async () => {
    localStorage.setItem('proto_cookie_consent_accepted_v1', 'true');
    const { initAnalytics, loadAnalytics } = await freshModule();
    initAnalytics();
    loadAnalytics();
    expect(gtagScripts()).toHaveLength(1);
    expect(gtagScripts()[0].src).toContain('id=G-');
    expect(typeof window.gtag).toBe('function');
  });
});
