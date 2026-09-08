import { describe, it, expect } from 'vitest';
import { useLaunchpad } from '../src/composables/useLaunchpad';

describe('useLaunchpad composable', () => {
  it('initializes with clean state', () => {
    const { loading, error, tokens } = useLaunchpad();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
    expect(tokens.value).toEqual([]);
  });
});
