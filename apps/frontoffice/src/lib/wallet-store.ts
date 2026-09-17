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

export const STORAGE_CONNECTED_KEY = 'proto_wallet_connected';
export const STORAGE_PROVIDER_ID_KEY = 'proto_wallet_provider_id';
export const STORAGE_ADDRESS_KEY = 'proto_wallet_address';
export const STORAGE_CHAIN_ID_KEY = 'proto_wallet_chain_id';
export const WALLET_SYNC_CHANNEL = 'proto_wallet_sync';

export interface WalletSyncMessage {
  type:
    'WALLET_CONNECTED' | 'WALLET_DISCONNECTED' | 'WALLET_CHAIN_CHANGED' | 'WALLET_ACCOUNTS_CHANGED';
  address?: string;
  chainId?: number;
  providerId?: string | null;
}

export const walletProvider = shallowRef<WalletProviderLike | null>(null);
export const walletAddress = shallowRef<`0x${string}` | null>(null);
export const walletChainId = shallowRef<number | null>(null);
export const walletProviderId = shallowRef<string | null>(null);
export const walletModalOpen = shallowRef(false);

let activeProviderCleanup: (() => void) | null = null;
let syncChannel: BroadcastChannel | null = null;

export function getWalletSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!syncChannel) {
    try {
      syncChannel = new BroadcastChannel(WALLET_SYNC_CHANNEL);
    } catch {
      syncChannel = null;
    }
  }
  return syncChannel;
}

export function broadcastWalletEvent(message: WalletSyncMessage) {
  const channel = getWalletSyncChannel();
  if (channel) {
    try {
      channel.postMessage(message);
    } catch {
      // Ignore postMessage error
    }
  }
}

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
      const nextAddr = list[0] as `0x${string}`;
      walletAddress.value = nextAddr;
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        try {
          localStorage.setItem(STORAGE_ADDRESS_KEY, nextAddr);
        } catch {
          // Ignore
        }
      }
      callbacks?.onAccountsChanged?.(list);
      broadcastWalletEvent({
        type: 'WALLET_ACCOUNTS_CHANGED',
        address: nextAddr,
        chainId: walletChainId.value ?? undefined,
      });
    }
  };

  const handleChainChanged = (rawChainId: unknown) => {
    const parsed = normalizeChainId(rawChainId);
    if (parsed !== null) {
      walletChainId.value = parsed;
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        try {
          localStorage.setItem(STORAGE_CHAIN_ID_KEY, String(parsed));
        } catch {
          // Ignore
        }
      }
      callbacks?.onChainChanged?.(parsed);
      broadcastWalletEvent({
        type: 'WALLET_CHAIN_CHANGED',
        chainId: parsed,
        address: walletAddress.value ?? undefined,
      });
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
  options: { broadcast?: boolean } = { broadcast: true },
) {
  walletProvider.value = provider;
  walletAddress.value = address;
  walletChainId.value = chainId;
  walletProviderId.value = providerId ?? null;

  if (typeof window !== 'undefined' && 'localStorage' in window) {
    try {
      localStorage.setItem(STORAGE_CONNECTED_KEY, 'true');
      localStorage.setItem(STORAGE_ADDRESS_KEY, address);
      localStorage.setItem(STORAGE_CHAIN_ID_KEY, String(chainId));
      if (providerId) {
        localStorage.setItem(STORAGE_PROVIDER_ID_KEY, providerId);
      }
    } catch {
      // Ignore quota/private mode errors
    }
  }

  bindProviderListeners(provider);

  if (options.broadcast !== false) {
    broadcastWalletEvent({
      type: 'WALLET_CONNECTED',
      address,
      chainId,
      providerId: providerId ?? null,
    });
  }
}

export function clearWalletState(options: { broadcast?: boolean } = { broadcast: true }) {
  if (activeProviderCleanup) {
    activeProviderCleanup();
    activeProviderCleanup = null;
  }

  walletProvider.value = null;
  walletAddress.value = null;
  walletChainId.value = null;
  walletProviderId.value = null;

  if (typeof window !== 'undefined' && 'localStorage' in window) {
    try {
      localStorage.removeItem(STORAGE_CONNECTED_KEY);
      localStorage.removeItem(STORAGE_ADDRESS_KEY);
      localStorage.removeItem(STORAGE_CHAIN_ID_KEY);
      localStorage.removeItem(STORAGE_PROVIDER_ID_KEY);
    } catch {
      // Ignore
    }
  }

  if (options.broadcast !== false) {
    broadcastWalletEvent({ type: 'WALLET_DISCONNECTED' });
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
