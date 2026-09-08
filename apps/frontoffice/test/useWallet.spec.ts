import { describe, it, expect, beforeEach } from 'vitest';
import { useWallet } from '../src/composables/useWallet';
import {
  clearWalletState,
  setConnectedWallet,
  type WalletProviderLike,
} from '../src/lib/wallet-store';

describe('useWallet composable', () => {
  beforeEach(() => {
    clearWalletState();
  });

  it('initializes with clean and predictable state', () => {
    const { isConnected, isConnecting, formattedAddress, error } = useWallet();
    expect(isConnected.value).toBe(false);
    expect(isConnecting.value).toBe(false);
    expect(formattedAddress.value).toBe('');
    expect(error.value).toBeNull();
  });

  it('reflects connected wallet state and formatted values', () => {
    const mockProvider: WalletProviderLike = {
      request: async () => '0x1',
      on: () => {},
      removeListener: () => {},
    };

    setConnectedWallet(mockProvider, '0x1234567890abcdef1234567890abcdef12345678', 4663);

    const wallet = useWallet();
    expect(wallet.isConnected.value).toBe(true);
    expect(wallet.account.value).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(wallet.formattedAddress.value).toBe('0x1234...5678');
    expect(wallet.isCorrectNetwork.value).toBe(true);
  });

  it('disconnects wallet and clears internal state', async () => {
    const mockProvider: WalletProviderLike = {
      request: async () => '0x1',
      on: () => {},
      removeListener: () => {},
    };

    setConnectedWallet(mockProvider, '0x1234567890abcdef1234567890abcdef12345678', 4663);

    const wallet = useWallet();
    expect(wallet.isConnected.value).toBe(true);

    await wallet.disconnectWallet();

    expect(wallet.isConnected.value).toBe(false);
    expect(wallet.account.value).toBeNull();
    expect(wallet.chainId.value).toBeNull();
    expect(wallet.balanceWei.value).toBe(0n);
  });
});
