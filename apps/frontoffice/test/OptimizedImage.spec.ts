// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OptimizedImage from '../src/components/ui/OptimizedImage.vue';

describe('OptimizedImage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stops the skeleton and shows the fallback when a logo never loads', async () => {
    const wrapper = mount(OptimizedImage, {
      props: { src: 'ipfs://bafymissing', alt: 'Missing', fallbackText: 'GLASSCAT' },
    });
    expect(wrapper.find('[data-slot="skeleton"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('GLA');

    await vi.advanceTimersByTimeAsync(4000);

    expect(wrapper.find('[data-slot="skeleton"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('GLA');
    // The image keeps trying underneath and covers the fallback if it arrives.
    await wrapper.find('img').trigger('load');
    expect(wrapper.text()).not.toContain('GLA');
  });

  it('shows no skeleton for a token without a logo', () => {
    const wrapper = mount(OptimizedImage, { props: { alt: 'No logo', fallbackText: 'TT' } });
    expect(wrapper.find('[data-slot="skeleton"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('TT');
  });
});
