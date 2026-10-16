// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import MaintenanceBanner from '../src/components/MaintenanceBanner.vue';

function mockStatus(body: unknown, contentType = 'application/json', ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      headers: { get: () => contentType },
      json: async () => body,
    })),
  );
}

describe('MaintenanceBanner', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the worker message in banner mode', async () => {
    mockStatus({ maintenance: 'banner', message: 'Upgrade at 14:00 UTC' });
    const wrapper = mount(MaintenanceBanner);
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('Upgrade at 14:00 UTC');
  });

  it('falls back to the translated default text without a message', async () => {
    mockStatus({ maintenance: 'banner', message: '' });
    const wrapper = mount(MaintenanceBanner);
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('Scheduled maintenance');
  });

  it('renders nothing when maintenance is off or full', async () => {
    for (const maintenance of ['off', 'full']) {
      mockStatus({ maintenance, message: 'x' });
      const wrapper = mount(MaintenanceBanner);
      await flushPromises();
      expect(wrapper.find('[role="status"]').exists()).toBe(false);
    }
  });

  it('ignores a missing endpoint (local dev serves HTML)', async () => {
    mockStatus('<!doctype html>', 'text/html');
    const wrapper = mount(MaintenanceBanner);
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('remembers a dismissal for the session, per message', async () => {
    mockStatus({ maintenance: 'banner', message: 'First notice' });
    const first = mount(MaintenanceBanner);
    await flushPromises();
    await first.get('button').trigger('click');
    expect(first.find('[role="status"]').exists()).toBe(false);

    const again = mount(MaintenanceBanner);
    await flushPromises();
    expect(again.find('[role="status"]').exists()).toBe(false);

    mockStatus({ maintenance: 'banner', message: 'A new notice' });
    const updated = mount(MaintenanceBanner);
    await flushPromises();
    expect(updated.get('[role="status"]').text()).toContain('A new notice');
  });
});
