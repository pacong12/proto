import { shallowRef } from 'vue';

export interface WalletRequestArgs {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface WalletProviderLike {
  request: (args: WalletRequestArgs) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
}

export interface WalletCandidate {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: WalletProviderLike;
}

const STORAGE_CONNECTED_KEY = 'proto_wallet_connected';
const STORAGE_PROVIDER_ID_KEY = 'proto_wallet_provider_id';

export const walletProvider = shallowRef<WalletProviderLike | null>(null);
export const walletAddress = shallowRef<`0x${string}` | null>(null);
export const walletChainId = shallowRef<number | null>(null);
export const walletModalOpen = shallowRef(false);

let activeProviderCleanup: (() => void) | null = null;

function normalizeChainId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = raw.startsWith('0x') ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function bindProviderListeners(
  provider: WalletProviderLike,
  callbacks?: {
    onAccountsChanged?: (accounts: string[]) => void;
    onChainChanged?: (chainId: number) => void;
    onDisconnect?: () => void;
  },
) {
  if (activeProviderCleanup) {
    activeProviderCleanup();
    activeProviderCleanup = null;
  }

  if (!provider.on) return;

  const handleAccountsChanged = (accounts: unknown) => {
    const list = Array.isArray(accounts) ? (accounts as string[]) : [];
    if (list.length === 0) {
      clearWalletState();
    } else {
      walletAddress.value = list[0] as `0x${string}`;
      callbacks?.onAccountsChanged?.(list);
    }
  };

  const handleChainChanged = (rawChainId: unknown) => {
    const parsed = normalizeChainId(rawChainId);
    if (parsed !== null) {
      walletChainId.value = parsed;
      callbacks?.onChainChanged?.(parsed);
    }
  };

  const handleDisconnect = () => {
    clearWalletState();
    callbacks?.onDisconnect?.();
  };

  provider.on('accountsChanged', handleAccountsChanged);
  provider.on('chainChanged', handleChainChanged);
  provider.on('disconnect', handleDisconnect);

  activeProviderCleanup = () => {
    provider.removeListener?.('accountsChanged', handleAccountsChanged);
    provider.removeListener?.('chainChanged', handleChainChanged);
    provider.removeListener?.('disconnect', handleDisconnect);
  };
}

export function setConnectedWallet(
  provider: WalletProviderLike,
  address: `0x${string}`,
  chainId: number,
  providerId?: string,
) {
  walletProvider.value = provider;
  walletAddress.value = address;
  walletChainId.value = chainId;

  if (typeof window !== 'undefined' && 'localStorage' in window) {
    try {
      localStorage.setItem(STORAGE_CONNECTED_KEY, 'true');
      if (providerId) {
        localStorage.setItem(STORAGE_PROVIDER_ID_KEY, providerId);
      }
    } catch {
      // Ignore quota/private mode errors
    }
  }

  bindProviderListeners(provider);
}

export function clearWalletState() {
  if (activeProviderCleanup) {
    activeProviderCleanup();
    activeProviderCleanup = null;
  }

  walletProvider.value = null;
  walletAddress.value = null;
  walletChainId.value = null;

  if (typeof window !== 'undefined' && 'localStorage' in window) {
    try {
      localStorage.removeItem(STORAGE_CONNECTED_KEY);
      localStorage.removeItem(STORAGE_PROVIDER_ID_KEY);
    } catch {
      // Ignore
    }
  }
}

export function isStoredConnectionActive(): boolean {
  if (typeof window === 'undefined' || !('localStorage' in window)) return false;
  try {
    return localStorage.getItem(STORAGE_CONNECTED_KEY) === 'true';
  } catch {
    return false;
  }
}
