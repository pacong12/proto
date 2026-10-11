import { describe, it, expect } from 'vitest';
import { useTokenStore } from '../src/composables/useTokenStore';

describe('useTokenStore Composable & Centralized Chain Logic', () => {
  it('initializes with clean reactive state', () => {
    const { tokens, networkTokens, networkTokenAddresses, isTokenOnActiveNetwork, loading, error } =
      useTokenStore();
    expect(tokens.value).toBeDefined();
    expect(networkTokens.value).toBeDefined();
    expect(networkTokenAddresses.value).toBeInstanceOf(Set);
    expect(typeof isTokenOnActiveNetwork).toBe('function');
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('correctly identifies whether an address or token belongs to active network', () => {
    const { isTokenOnActiveNetwork } = useTokenStore();
    // Arbitrary unindexed address returns false
    expect(isTokenOnActiveNetwork('0x0000000000000000000000000000000000000000')).toBe(false);
  });
});
