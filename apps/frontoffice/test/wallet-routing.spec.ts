import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '../src/composables/useWallet';
import { findAnnouncedProvider } from '../src/lib/eip6963';
import { getWalletClient } from '../src/lib/viem-client';
import {
  STORAGE_ADDRESS_KEY,
  STORAGE_CONNECTED_KEY,
  STORAGE_PROVIDER_ID_KEY,
  clearWalletState,
  setConnectedWallet,
  walletAddress,
  walletProvider,
  type WalletProviderLike,
} from '../src/lib/wallet-store';

vi.mock('../src/lib/appkit-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/appkit-loader')>()),
  appKitConfigured: false,
}));

const CHOSEN = '0x1111111111111111111111111111111111111111' as const;
const OTHER = '0x2222222222222222222222222222222222222222' as const;
const ARC_CHAIN_HEX = '0x4cef52';

function fakeWallet(address: string): WalletProviderLike {
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [address];
      if (method === 'eth_chainId') return ARC_CHAIN_HEX;
      return null;
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as WalletProviderLike;
}

/** Makes a wallet answer EIP-6963 requests the way an extension does. */
function announce(rdns: string, provider: WalletProviderLike) {
  window.addEventListener('eip6963:requestProvider', () => {
    const event = new Event('eip6963:announceProvider');
    Object.assign(event, { detail: { info: { rdns, uuid: 'u', name: rdns, icon: '' }, provider } });
    window.dispatchEvent(event);
  });
}

/** What another tab's connect, or a reload, runs: reconnects from what storage says. */
function reconnectFromStorage() {
  useWallet();
  const event = new Event('storage');
  Object.assign(event, { key: STORAGE_CONNECTED_KEY, newValue: 'true' });
  window.dispatchEvent(event);
}

function storeChoice(walletId: string) {
  localStorage.setItem(STORAGE_CONNECTED_KEY, 'true');
  localStorage.setItem(STORAGE_ADDRESS_KEY, CHOSEN);
  localStorage.setItem(STORAGE_PROVIDER_ID_KEY, walletId);
}

beforeEach(() => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: storage }));
  clearWalletState({ broadcast: false });
});

describe('getWalletClient', () => {
  it('signs with the chosen wallet even when Bitget is installed', async () => {
    const chosen = fakeWallet(CHOSEN);
    const bitget = fakeWallet(OTHER);
    Object.assign(window, { bitkeep: { ethereum: bitget }, bitget: { ethereum: bitget } });
    setConnectedWallet(chosen, CHOSEN, 5042002, 'io.metamask', { broadcast: false });

    const client = await getWalletClient();

    expect(await client!.getAddresses()).toEqual([CHOSEN]);
    expect(bitget.request).not.toHaveBeenCalled();
  });

  it('has nothing to sign with until a wallet is connected, whatever is installed', async () => {
    Object.assign(window, { bitkeep: { ethereum: fakeWallet(OTHER) } });

    expect(await getWalletClient()).toBeNull();
  });
});

describe('findAnnouncedProvider', () => {
  it('resolves with the wallet that matches, ignoring the others', async () => {
    const chosen = fakeWallet(CHOSEN);
    announce('com.other', fakeWallet(OTHER));
    announce('io.metamask', chosen);

    await expect(findAnnouncedProvider('io.metamask')).resolves.toBe(chosen);
  });

  it('resolves with null when the wallet does not answer', async () => {
    await expect(findAnnouncedProvider('io.metamask', 1)).resolves.toBeNull();
  });
});

describe('reconnecting after a reload', () => {
  it('finds the chosen wallet again, not the one that owns window.ethereum', async () => {
    const chosen = fakeWallet(CHOSEN);
    const owner = fakeWallet(OTHER);
    Object.assign(window, { ethereum: owner });
    announce('io.metamask', chosen);
    storeChoice('io.metamask');

    reconnectFromStorage();

    await vi.waitFor(() => expect(walletProvider.value).toBe(chosen));
    expect(walletAddress.value).toBe(CHOSEN);
    expect(owner.request).not.toHaveBeenCalled();
  });

  it('remembers which wallet was chosen, so the next reload finds it too', async () => {
    announce('io.metamask', fakeWallet(CHOSEN));
    storeChoice('io.metamask');

    reconnectFromStorage();

    await vi.waitFor(() => expect(walletAddress.value).toBe(CHOSEN));
    expect(localStorage.getItem(STORAGE_PROVIDER_ID_KEY)).toBe('io.metamask');
  });

  it('disconnects when the chosen wallet is gone, rather than using another', async () => {
    const owner = fakeWallet(OTHER);
    Object.assign(window, { ethereum: owner });
    storeChoice('io.metamask');

    reconnectFromStorage();

    await vi.waitFor(() => expect(localStorage.getItem(STORAGE_CONNECTED_KEY)).toBeNull(), {
      timeout: 3_000,
    });
    expect(walletAddress.value).toBeNull();
    expect(owner.request).not.toHaveBeenCalled();
  });

  it('still uses window.ethereum when that is what the user chose', async () => {
    const owner = fakeWallet(CHOSEN);
    Object.assign(window, { ethereum: owner });
    storeChoice('window.ethereum');

    reconnectFromStorage();

    await vi.waitFor(() => expect(walletProvider.value).toBe(owner));
  });
});
