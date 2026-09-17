import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ARC_CHAIN, ROBINHOOD_CHAIN } from '@proto/shared-types';
import { useWallet } from '../src/composables/useWallet';
import {
  clearWalletState,
  setConnectedWallet,
  type WalletProviderLike,
} from '../src/lib/wallet-store';

describe('useWallet composable', () => {
  let fakeStore: Record<string, string> = {};
  let listeners: Record<string, ((event: unknown) => void)[]> = {};

  beforeEach(() => {
    fakeStore = {};
    listeners = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => fakeStore[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        fakeStore[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete fakeStore[key];
      }),
    };
    vi.stubGlobal('localStorage', mockStorage);

    const mockWindow = {
      localStorage: mockStorage,
      addEventListener: vi.fn((event: string, cb: (e: unknown) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: (e: unknown) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l) => l !== cb);
        }
      }),
      dispatchEvent: vi.fn((event: { type: string; key?: string; newValue?: string | null }) => {
        if (listeners[event.type]) {
          for (const cb of listeners[event.type]) cb(event);
        }
      }),
    };
    vi.stubGlobal('window', mockWindow);
    clearWalletState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('switches active network when disconnected', async () => {
    const wallet = useWallet();
    expect(wallet.activeNetwork.value.chainId).toBe(ROBINHOOD_CHAIN.chainId);

    const success = await wallet.switchOrAddNetwork(ARC_CHAIN);
    expect(success).toBe(true);
    expect(wallet.activeNetwork.value.chainId).toBe(ARC_CHAIN.chainId);
  });

  it('synchronizes wallet disconnection via cross-tab storage event', async () => {
    const mockProvider: WalletProviderLike = {
      request: async () => '0x1',
      on: () => {},
      removeListener: () => {},
    };

    setConnectedWallet(mockProvider, '0x1234567890abcdef1234567890abcdef12345678', 4663);
    const wallet = useWallet();
    expect(wallet.isConnected.value).toBe(true);

    // Simulate cross-tab disconnect storage event from another tab
    window.dispatchEvent({
      type: 'storage',
      key: 'proto_wallet_connected',
      newValue: null,
    } as unknown as Event);

    expect(wallet.isConnected.value).toBe(false);
    expect(wallet.account.value).toBeNull();
  });
});
