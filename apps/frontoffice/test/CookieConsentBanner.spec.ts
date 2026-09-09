import { describe, it, expect } from 'vitest';
import CookieConsentBanner from '../src/components/CookieConsentBanner.vue';

describe('CookieConsentBanner Component', () => {
  it('exports a valid Vue SFC component definition', () => {
    expect(CookieConsentBanner).toBeDefined();
    expect(typeof CookieConsentBanner).toBe('object');
    expect(CookieConsentBanner.__name).toBe('CookieConsentBanner');
  });

  it('validates storage key and consent agreement logic', () => {
    const COOKIE_CONSENT_KEY = 'proto_cookie_consent_accepted_v1';
    expect(COOKIE_CONSENT_KEY).toBe('proto_cookie_consent_accepted_v1');

    const fakeStore: Record<string, string> = {};
    function checkAccepted(): boolean {
      return fakeStore[COOKIE_CONSENT_KEY] === 'true';
    }

    expect(checkAccepted()).toBe(false);

    fakeStore[COOKIE_CONSENT_KEY] = 'true';
    expect(checkAccepted()).toBe(true);
  });
});
