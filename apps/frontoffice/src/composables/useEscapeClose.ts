import { toValue, type MaybeRefOrGetter } from 'vue';
import { useEventListener } from '@vueuse/core';

/** Closes an overlay when Escape is pressed while it is open. */
export function useEscapeClose(open: MaybeRefOrGetter<boolean>, close: () => void): void {
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && toValue(open)) close();
  });
}
