import { computed, getCurrentInstance, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  DEFAULT_NETWORK,
  SUPPORTED_CHAINS,
  getNetworkConfig,
  type NetworkConfig,
} from '@goton/shared-types';
import {
  appKitAccount,
  appKitChainId,
  appKitConfigured,
  appKitWalletProvider,
  getAppKit,
  loadAppKit,
} from '../lib/appkit-loader';
import {
  bindProviderListeners,
  clearWalletState,
  getWalletSyncChannel,
  isStoredConnectionActive,
  setConnectedWallet,
  walletAddress,
  walletChainId,
  walletProviderId,
  walletModalOpen,
  walletProvider,
  STORAGE_CONNECTED_KEY,
  STORAGE_ADDRESS_KEY,
  STORAGE_CHAIN_ID_KEY,
  STORAGE_PROVIDER_ID_KEY,
  type WalletProviderLike,
  type WalletSyncMessage,
} from '../lib/wallet-store';
import { shortenAddress } from '../lib/utils';
import { switchProviderNetwork } from '../lib/wallet-network';

const balanceWei = ref<bigint>(0n);
const error = ref<string | null>(null);
const isConnecting = ref(false);
let syncBalancePromise: Promise<void> | null = null;
let lastSyncTime = 0;
function parseChainId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = raw.startsWith('0x') ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function useWallet() {
  const resolvedAddress = computed<`0x${string}` | null>(() => {
    if (walletAddress.value) return walletAddress.value;
    if (appKitConfigured && appKitAccount.value?.address && isStoredConnectionActive()) {
      return appKitAccount.value.address as `0x${string}`;
    }
    if (isStoredConnectionActive() && typeof window !== 'undefined' && 'localStorage' in window) {
      // FO-08: the stored address is only a placeholder while AppKit restores the session. Once
      // AppKit reports the wallet as disconnected, it is not connected, whatever storage says.
      if (appKitConfigured && appKitAccount.value?.status === 'disconnected') return null;
      const stored = localStorage.getItem(STORAGE_ADDRESS_KEY);
      if (stored && stored.startsWith('0x') && stored.length === 42) {
        return stored as `0x${string}`;
      }
    }
    return null;
  });

  const formattedAddress = computed(() => {
    return shortenAddress(resolvedAddress.value);
  });

  const formattedBalance = computed(() => {
    const decimals = activeNetwork.value.nativeCurrency.decimals;
    const divisor = 10 ** decimals;
    const val = Number(balanceWei.value) / divisor;
    return `${val.toFixed(4)} ${activeNetwork.value.nativeCurrency.symbol}`;
  });

  const isConnected = computed(() => resolvedAddress.value !== null);

  const isCorrectNetwork = computed(() => {
    return Boolean(walletChainId.value && SUPPORTED_CHAINS[walletChainId.value]);
  });

  const activeNetwork = computed((): NetworkConfig => {
    return getNetworkConfig(walletChainId.value ?? undefined);
  });

  async function syncBalance(
    addressValue?: `0x${string}`,
    explicitChainId?: number,
    force = false,
  ) {
    const target = addressValue ?? resolvedAddress.value ?? walletAddress.value;
    if (!target) {
      balanceWei.value = 0n;
      return;
    }
    const now = Date.now();
    if (syncBalancePromise) return syncBalancePromise;
    if (!force && now - lastSyncTime < 1500) return;
    lastSyncTime = now;

    syncBalancePromise = (async () => {
      try {
        // Loaded on demand: the RPC client (viem) stays out of the initial bundle.
        const { getPublicClient } = await import('../lib/viem-client');
        const client = getPublicClient(explicitChainId ?? walletChainId.value ?? undefined);
        balanceWei.value = await client.getBalance({ address: target });
      } catch {
        // Keep current balance on transient error, avoid flickering to 0
      } finally {
        syncBalancePromise = null;
      }
    })();
    return syncBalancePromise;
  }

  function getInjectedProvider(preferredId?: string | null): WalletProviderLike | null {
    if (typeof window === 'undefined') return null;

    const id = (
      preferredId ||
      walletProviderId.value ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PROVIDER_ID_KEY) : '') ||
      ''
    ).toLowerCase();

    const win = window as unknown as Record<string, unknown>;

    // 1. Bitget / BitKeep dedicated injected provider
    if (id.includes('bitget') || id.includes('bitkeep')) {
      const bitkeep = win.bitkeep as { ethereum?: WalletProviderLike } | undefined;
      const bitget = win.bitget as { ethereum?: WalletProviderLike } | undefined;
      if (bitget?.ethereum) return bitget.ethereum;
      if (bitkeep?.ethereum) return bitkeep.ethereum;
    }

    // 2. OKX dedicated injected provider
    if (id.includes('okx') || id.includes('okex')) {
      const okx = win.okxwallet as WalletProviderLike | undefined;
      if (okx) return okx;
    }

    // 3. Multi-provider array (EIP-5749 / window.ethereum.providers)
    const eth = win.ethereum as
      | (WalletProviderLike & {
          providers?: Array<
            WalletProviderLike & {
              isBitKeep?: boolean;
              isBitget?: boolean;
              isOkxWallet?: boolean;
              isMetaMask?: boolean;
            }
          >;
        })
      | undefined;

    if (eth?.providers && Array.isArray(eth.providers)) {
      if (id.includes('bitget') || id.includes('bitkeep')) {
        const bitgetMatch = eth.providers.find((p) => p.isBitKeep || p.isBitget);
        if (bitgetMatch) return bitgetMatch;
      }
      if (id.includes('okx') || id.includes('okex')) {
        const okxMatch = eth.providers.find((p) => p.isOkxWallet);
        if (okxMatch) return okxMatch;
      }
      if (id.includes('metamask')) {
        const mmMatch = eth.providers.find((p) => p.isMetaMask && !p.isOkxWallet && !p.isBitget);
        if (mmMatch) return mmMatch;
      }
    }

    // 4. Fallback to window.ethereum
    if (eth) {
      return eth;
    }

    return null;
  }

  async function tryAutoReconnectInjected(force = false) {
    if ((walletAddress.value && !force) || !isStoredConnectionActive()) return;

    const provider = getInjectedProvider();
    if (!provider) {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const storedAddr = localStorage.getItem(STORAGE_ADDRESS_KEY) as `0x${string}` | null;
        const storedChain = parseChainId(localStorage.getItem(STORAGE_CHAIN_ID_KEY));
        if (storedAddr) {
          walletAddress.value = storedAddr;
          walletChainId.value = storedChain ?? DEFAULT_NETWORK.chainId;
        }
      }
      return;
    }

    try {
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (accounts && accounts.length > 0) {
        const address = accounts[0] as `0x${string}`;
        const rawChain = await provider.request({ method: 'eth_chainId' });
        const chain = parseChainId(rawChain) ?? DEFAULT_NETWORK.chainId;

        setConnectedWallet(provider, address, chain, 'window.ethereum', { broadcast: false });

        // Validate the chain before syncing balance (fix MED-01).
        // getPublicClient() follows the active chain, but we must not query an
        // unsupported chain at all; set balance to 0 and warn instead.
        const isSupportedChain = Boolean(chain && SUPPORTED_CHAINS[chain]);

        if (!isSupportedChain) {
          console.warn(
            `[useWallet] Auto-reconnect on unsupported chain ${chain}. ` +
              'Balance will show 0 until the user switches to a supported network.',
          );
          balanceWei.value = 0n;
        } else {
          await syncBalance(address);
        }
      } else {
        clearWalletState({ broadcast: false });
      }
    } catch {
      clearWalletState({ broadcast: false });
    }
  }

  async function openWallet() {
    error.value = null;
    if (appKitConfigured) {
      try {
        const appKit = await getAppKit();
        if (appKit) {
          await appKit.open();
          return;
        }
      } catch (err) {
        console.warn('[useWallet] AppKit open failed, falling back to local modal:', err);
      }
    }
    walletModalOpen.value = true;
  }

  async function connectWallet(): Promise<`0x${string}` | null> {
    isConnecting.value = true;
    error.value = null;
    try {
      await openWallet();
      return walletAddress.value;
    } finally {
      isConnecting.value = false;
    }
  }

  async function disconnectWallet() {
    error.value = null;
    isConnecting.value = false;

    // Only sessions opened through AppKit need it loaded to disconnect.
    if (appKitConfigured && (walletProviderId.value === 'reown' || appKitAccount.value?.address)) {
      try {
        const appKit = await getAppKit();
        await appKit?.disconnect();
      } catch (err) {
        console.warn('[useWallet] Disconnect action failed, forcing local cleanup:', err);
      }
    }

    clearWalletState();
    balanceWei.value = 0n;
  }

  async function switchOrAddNetwork(
    targetConfig: NetworkConfig = DEFAULT_NETWORK,
  ): Promise<boolean> {
    error.value = null;
    walletChainId.value = targetConfig.chainId;

    if (typeof window !== 'undefined' && 'localStorage' in window) {
      try {
        localStorage.setItem(STORAGE_CHAIN_ID_KEY, String(targetConfig.chainId));
      } catch {
        // Ignore storage errors
      }
    }

    if (walletAddress.value) {
      await syncBalance(walletAddress.value);
    }

    if (appKitConfigured) {
      try {
        const { appKit, getAppKitChain } = await loadAppKit();
        if (!appKit) throw new Error('AppKit unavailable');
        await appKit.switchNetwork(getAppKitChain(targetConfig.chainId));
        return true;
      } catch (err) {
        console.warn('[useWallet] AppKit switchNetwork failed:', err);
      }
    }

    const provider = walletProvider.value ?? getInjectedProvider();
    if (!provider) {
      return true;
    }

    try {
      await switchProviderNetwork(provider, targetConfig);
      return true;
    } catch (switchError: unknown) {
      error.value = (switchError as Error).message;
      return false;
    }
  }

  let crossTabSyncCleanup: (() => void) | null = null;

  function setupCrossTabSync() {
    if (typeof window === 'undefined') return;
    if (crossTabSyncCleanup) {
      crossTabSyncCleanup();
      crossTabSyncCleanup = null;
    }
    // 1. BroadcastChannel for instant messaging across open tabs
    const channel = getWalletSyncChannel();
    const handleBroadcast = async (event: MessageEvent<WalletSyncMessage>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'WALLET_CONNECTED' || data.type === 'WALLET_ACCOUNTS_CHANGED') {
        if (data.address && walletAddress.value !== data.address) {
          await tryAutoReconnectInjected(true);
        }
      } else if (data.type === 'WALLET_CHAIN_CHANGED') {
        if (data.chainId && walletChainId.value !== data.chainId) {
          walletChainId.value = data.chainId;
          await syncBalance();
        }
      } else if (data.type === 'WALLET_DISCONNECTED') {
        if (walletAddress.value) {
          clearWalletState({ broadcast: false });
          balanceWei.value = 0n;
        }
      }
    };

    if (channel) {
      channel.addEventListener('message', handleBroadcast);
    }

    // 2. Storage event listener (standard across tabs in same origin)
    const handleStorage = async (event: StorageEvent) => {
      if (event.key === STORAGE_CONNECTED_KEY) {
        if (event.newValue === 'true') {
          await tryAutoReconnectInjected(true);
        } else if (event.newValue === null || event.newValue === 'false') {
          clearWalletState({ broadcast: false });
          balanceWei.value = 0n;
        }
      } else if (event.key === STORAGE_ADDRESS_KEY && event.newValue) {
        if (walletAddress.value !== event.newValue) {
          await tryAutoReconnectInjected(true);
        }
      } else if (event.key === STORAGE_CHAIN_ID_KEY && event.newValue) {
        const parsed = Number(event.newValue);
        if (Number.isFinite(parsed) && walletChainId.value !== parsed) {
          walletChainId.value = parsed;
          await syncBalance();
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Tab Visibility & Focus re-validation (when user switches to Tab 2)
    const handleFocusOrVisibility = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!walletAddress.value && isStoredConnectionActive()) {
        await tryAutoReconnectInjected(true);
      } else if (walletAddress.value && !isStoredConnectionActive()) {
        clearWalletState({ broadcast: false });
        balanceWei.value = 0n;
      } else if (walletAddress.value) {
        await syncBalance();
      }
    };
    window.addEventListener('focus', handleFocusOrVisibility);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleFocusOrVisibility);
    }

    crossTabSyncCleanup = () => {
      if (channel) {
        channel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocusOrVisibility);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      }
    };
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      if (walletAddress.value) {
        syncBalance(walletAddress.value);
      } else {
        tryAutoReconnectInjected();
      }
      setupCrossTabSync();
    });

    onUnmounted(() => {
      if (crossTabSyncCleanup) {
        crossTabSyncCleanup();
        crossTabSyncCleanup = null;
      }
    });
  } else {
    setupCrossTabSync();
  }

  if (appKitConfigured) {
    watch(
      () => appKitAccount.value?.address,
      (next, prev) => {
        if (next && next !== prev) {
          const address = next as `0x${string}`;
          const currentProvider =
            (appKitWalletProvider.value as WalletProviderLike | null) ?? getInjectedProvider();

          const storedChain =
            typeof localStorage !== 'undefined'
              ? parseChainId(localStorage.getItem(STORAGE_CHAIN_ID_KEY))
              : null;
          const currentChain =
            storedChain ?? parseChainId(appKitChainId.value) ?? DEFAULT_NETWORK.chainId;

          if (currentProvider) {
            setConnectedWallet(currentProvider, address, currentChain, 'reown');
          } else {
            walletAddress.value = address;
            walletChainId.value = currentChain;
          }
          syncBalance(address);
        } else if (!next && prev) {
          clearWalletState();
        }
      },
      { immediate: true },
    );

    watch(
      () => appKitWalletProvider.value,
      (next) => {
        if (next && walletAddress.value) {
          const p = next as unknown as WalletProviderLike;
          walletProvider.value = p;
          bindProviderListeners(p);
        }
      },
    );

    watch(
      () => appKitChainId.value,
      (next, prev) => {
        if (next && next !== prev) {
          const parsed = parseChainId(next);
          if (parsed !== null && SUPPORTED_CHAINS[parsed]) {
            walletChainId.value = parsed;
            if (typeof localStorage !== 'undefined') {
              try {
                localStorage.setItem(STORAGE_CHAIN_ID_KEY, String(parsed));
              } catch {
                // Ignore
              }
            }
          }
        }
      },
    );
  }

  return {
    account: resolvedAddress,
    chainId: walletChainId,
    balanceWei,
    isConnecting,
    isConnected,
    isCorrectNetwork,
    formattedAddress,
    formattedBalance,
    activeNetwork,
    error,
    connectWallet,
    disconnectWallet,
    switchOrAddNetwork,
    openWallet,
    updateBalance: syncBalance,
    appKitConfigured: computed(() => appKitConfigured),
  };
}
