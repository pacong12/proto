import { describe, it, expect } from 'vitest';
import { useLaunchpad } from '../src/composables/useLaunchpad';

describe('useLaunchpad composable', () => {
  it('initializes with clean state', () => {
    const { loading, error, tokens, launchStep, launchTxHash, launchTokenAddress } = useLaunchpad();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
    expect(tokens.value).toEqual([]);
    expect(launchStep.value).toBe('idle');
    expect(launchTxHash.value).toBeNull();
    expect(launchTokenAddress.value).toBeNull();
  });

  it('resets launch state cleanly', () => {
    const { launchStep, launchTxHash, launchTokenAddress, resetLaunchState } = useLaunchpad();
    launchStep.value = 'error';
    launchTxHash.value = '0x1234' as `0x${string}`;
    launchTokenAddress.value = '0x5678' as `0x${string}`;

    resetLaunchState();

    expect(launchStep.value).toBe('idle');
    expect(launchTxHash.value).toBeNull();
    expect(launchTokenAddress.value).toBeNull();
  });
});
