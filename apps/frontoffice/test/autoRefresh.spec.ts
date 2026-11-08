// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useAutoRefresh } from '../src/composables/useAutoRefresh';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

function host(refresh: () => unknown, ms: number) {
  return mount(
    defineComponent({
      setup() {
        useAutoRefresh(refresh, ms);
        return () => h('div');
      },
    }),
  );
}

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it('refreshes on every interval while the page is visible, and stops on unmount', async () => {
    const refresh = vi.fn();
    const w = host(refresh, 1000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(3);
    w.unmount();
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('pauses in a background tab and catches up once it is shown again', async () => {
    const refresh = vi.fn();
    host(refresh, 1000);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).not.toHaveBeenCalled();
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never overlaps a refresh that is still running', async () => {
    let finish: () => void = () => {};
    const refresh = vi.fn(() => new Promise<void>((r) => (finish = r)));
    host(refresh, 1000);
    await vi.advanceTimersByTimeAsync(3500);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
