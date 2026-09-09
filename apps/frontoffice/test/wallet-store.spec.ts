import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  walletProvider,
  walletAddress,
  walletChainId,
  walletModalOpen,
  setConnectedWallet,
  clearWalletState,
  type WalletProviderLike,
} from '../src/lib/wallet-store';

describe('WalletStore State Management', () => {
  let fakeStore: Record<string, string> = {};

  beforeEach(() => {
    fakeStore = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => fakeStore[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        fakeStore[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete fakeStore[key];
      }),
      clear: vi.fn(() => {
        fakeStore = {};
      }),
    };
    vi.stubGlobal('localStorage', mockStorage);
    clearWalletState();
  });

  it('initializes with clean and disconnected shallowRefs', () => {
    expect(walletProvider.value).toBeNull();
    expect(walletAddress.value).toBeNull();
    expect(walletChainId.value).toBeNull();
    expect(walletModalOpen.value).toBe(false);
  });

  it('sets connected wallet and normalizes address and chainId', () => {
    const mockProvider: WalletProviderLike = {
      request: async () => ['0x555C0456641D5FF4FB47E24D6472B4A16AC1B0C2'],
    };

    setConnectedWallet(
      mockProvider,
      '0x555C0456641D5FF4FB47E24D6472B4A16AC1B0C2',
      4663,
      'metamask',
    );
    expect(walletAddress.value).toBe('0x555C0456641D5FF4FB47E24D6472B4A16AC1B0C2');
    expect(walletChainId.value).toBe(4663);
    expect(walletProvider.value).toBe(mockProvider);
  });

  it('disconnects and resets all shallowRefs to null', () => {
    const mockProvider: WalletProviderLike = {
      request: async () => [],
    };

    setConnectedWallet(mockProvider, '0x1111111111111111111111111111111111111111', 4663);
    expect(walletAddress.value).toBeTruthy();

    clearWalletState();

    expect(walletAddress.value).toBeNull();
    expect(walletChainId.value).toBeNull();
    expect(walletProvider.value).toBeNull();
  });
});
