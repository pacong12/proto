// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const enableAnalytics = vi.fn();
const disableAnalytics = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/analytics')>()),
  enableAnalytics: () => enableAnalytics(),
  disableAnalytics: () => disableAnalytics(),
}));

const KEY = 'proto_cookie_consent_accepted_v1';

/** Fresh consent state per test: it is read from localStorage when the module loads. */
async function mountBanner() {
  vi.resetModules();
  const consent = await import('../src/lib/consent');
  const { default: CookieConsentBanner } =
    await import('../src/components/CookieConsentBanner.vue');
  const wrapper = mount(CookieConsentBanner);
  await flushPromises();
  return { wrapper, consent };
}
const button = (wrapper: Awaited<ReturnType<typeof mountBanner>>['wrapper'], name: RegExp) =>
  wrapper.findAll('button').find((b) => name.test(b.text()))!;

// Each test re-imports the component (fresh consent state); the first import is slow under load.
describe('CookieConsentBanner (rendered)', { timeout: 20_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    enableAnalytics.mockClear();
    disableAnalytics.mockClear();
  });

  it('asks first-time visitors and names Google Analytics', async () => {
    const { wrapper } = await mountBanner();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Google Analytics');
  });

  it('stores consent and loads analytics only on accept', async () => {
    const { wrapper } = await mountBanner();
    expect(enableAnalytics).not.toHaveBeenCalled();
    await button(wrapper, /accept/i).trigger('click');
    expect(localStorage.getItem(KEY)).toBe('true');
    expect(enableAnalytics).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('remembers a decline, so the banner does not come back', async () => {
    const first = await mountBanner();
    await button(first.wrapper, /decline/i).trigger('click');
    expect(localStorage.getItem(KEY)).toBe('false');
    expect(enableAnalytics).not.toHaveBeenCalled();

    const again = await mountBanner();
    expect(again.wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('closing with X asks again on the next visit', async () => {
    const first = await mountBanner();
    await first.wrapper.get('button[aria-label="Dismiss cookie notice"]').trigger('click');
    expect(first.wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('reopens from Cookie settings and lets the visitor withdraw consent', async () => {
    localStorage.setItem(KEY, 'true');
    const { wrapper, consent } = await mountBanner();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);

    consent.cookieSettingsOpen.value = true;
    await flushPromises();
    expect(wrapper.text()).toContain('You accepted analytics cookies.');

    await button(wrapper, /decline/i).trigger('click');
    expect(localStorage.getItem(KEY)).toBe('false');
    expect(disableAnalytics).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('links the cookie policy on the docs site', async () => {
    const { wrapper } = await mountBanner();
    expect(wrapper.get('a').attributes('href')).toMatch(/\/cookie-policy$/);
  });
});
