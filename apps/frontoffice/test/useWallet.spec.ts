import { describe, it, expect } from 'vitest';
import { useWallet } from '../src/composables/useWallet';

describe('useWallet composable', () => {
  it('initializes with clean and predictable state', () => {
    const { isConnected, isConnecting, formattedAddress, error } = useWallet();
    expect(isConnected.value).toBe(false);
    expect(isConnecting.value).toBe(false);
    expect(formattedAddress.value).toBe('');
    expect(error.value).toBeNull();
  });

  it('disconnects wallet and clears internal state', () => {
    const wallet = useWallet();
    wallet.disconnectWallet();

    expect(wallet.isConnected.value).toBe(false);
    expect(wallet.account.value).toBeNull();
    expect(wallet.chainId.value).toBeNull();
    expect(wallet.balanceWei.value).toBe(0n);
  });
});
