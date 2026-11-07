// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useEscapeClose } from '../src/composables/useEscapeClose';

const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }));

describe('useEscapeClose', () => {
  it('closes an open overlay on Escape only', () => {
    const open = ref(true);
    const close = vi.fn();
    const scope = effectScope();
    scope.run(() => useEscapeClose(open, close));

    press('Enter');
    expect(close).not.toHaveBeenCalled();
    press('Escape');
    expect(close).toHaveBeenCalledTimes(1);

    open.value = false;
    press('Escape');
    expect(close).toHaveBeenCalledTimes(1);

    scope.stop();
    open.value = true;
    press('Escape');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
