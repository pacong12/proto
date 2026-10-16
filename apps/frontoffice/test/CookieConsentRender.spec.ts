// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const loadAnalytics = vi.fn();
vi.mock('@/lib/analytics', () => ({
  COOKIE_CONSENT_KEY: 'proto_cookie_consent_accepted_v1',
  loadAnalytics: () => loadAnalytics(),
}));

const { default: CookieConsentBanner } = await import('../src/components/CookieConsentBanner.vue');

describe('CookieConsentBanner (rendered)', () => {
  beforeEach(() => {
    localStorage.clear();
    loadAnalytics.mockClear();
  });

  it('asks first-time visitors and names Google Analytics', async () => {
    const wrapper = mount(CookieConsentBanner);
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Google Analytics');
  });

  it('stores consent and loads analytics only on accept', async () => {
    const wrapper = mount(CookieConsentBanner);
    await flushPromises();
    expect(loadAnalytics).not.toHaveBeenCalled();
    const accept = wrapper.findAll('button').find((b) => /accept/i.test(b.text()));
    await accept!.trigger('click');
    expect(localStorage.getItem('proto_cookie_consent_accepted_v1')).toBe('true');
    expect(loadAnalytics).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('stays hidden for visitors who already answered', async () => {
    localStorage.setItem('proto_cookie_consent_accepted_v1', 'true');
    const wrapper = mount(CookieConsentBanner);
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('links the cookie policy on the docs site', async () => {
    const wrapper = mount(CookieConsentBanner);
    await flushPromises();
    expect(wrapper.get('a').attributes('href')).toMatch(/\/cookie-policy$/);
  });
});
