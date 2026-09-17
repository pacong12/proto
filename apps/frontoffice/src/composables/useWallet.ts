import { computed, getCurrentInstance, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useDisconnect,
} from '@reown/appkit/vue';
import type { EIP1193Provider } from 'viem';
import {
  ROBINHOOD_CHAIN,
  SUPPORTED_CHAINS,
  getNetworkConfig,
  type NetworkConfig,
} from '@proto/shared-types';
import { getPublicClient } from '../lib/viem-client';
import { appKitConfigured } from '../lib/appkit';
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

const balanceWei = ref<bigint>(0n);
const error = ref<string | null>(null);
const isConnecting = ref(false);

function parseChainId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = raw.startsWith('0x') ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function useWallet() {
  const appKit = appKitConfigured ? useAppKit() : null;
  const disconnectAction = appKitConfigured ? useDisconnect() : null;
  const account = useAppKitAccount();
  const providerState = useAppKitProvider<EIP1193Provider>('eip155');
  const network = useAppKitNetwork();

  const formattedAddress = computed(() => {
    return shortenAddress(walletAddress.value);
  });

  const formattedBalance = computed(() => {
    const decimals = activeNetwork.value.nativeCurrency.decimals;
    const divisor = 10 ** decimals;
    const val = Number(balanceWei.value) / divisor;
    return `${val.toFixed(4)} ${activeNetwork.value.nativeCurrency.symbol}`;
  });

  const isConnected = computed(() => walletAddress.value !== null);

  const isCorrectNetwork = computed(() => {
    return Boolean(walletChainId.value && SUPPORTED_CHAINS[walletChainId.value]);
  });

  const activeNetwork = computed((): NetworkConfig => {
    return getNetworkConfig(walletChainId.value ?? undefined);
  });

  async function syncBalance(addressValue?: `0x${string}`) {
    const target = addressValue ?? walletAddress.value;
    if (!target) {
      balanceWei.value = 0n;
      return;
    }
    try {
      // Use getPublicClient() so balance is fetched from the wallet's active chain,
      // not always from mainnet (fix MED-01 and MED-03).
      balanceWei.value = await getPublicClient().getBalance({ address: target });
    } catch {
      balanceWei.value = 0n;
    }
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
          walletChainId.value = storedChain ?? ROBINHOOD_CHAIN.chainId;
        }
      }
      return;
    }

    try {
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (accounts && accounts.length > 0) {
        const address = accounts[0] as `0x${string}`;
        const rawChain = await provider.request({ method: 'eth_chainId' });
        const chain = parseChainId(rawChain) ?? ROBINHOOD_CHAIN.chainId;

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
    if (appKitConfigured && appKit) {
      try {
        await appKit.open();
        return;
      } catch (openErr) {
        // AppKit modal failed; fall back to the local modal.
        console.warn('[useWallet] AppKit open failed, falling back to local modal:', openErr);
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

    if (appKitConfigured && disconnectAction) {
      try {
        await disconnectAction.disconnect();
      } catch (err) {
        console.warn('[useWallet] Disconnect action failed, forcing local cleanup:', err);
      }
    }

    clearWalletState();
    balanceWei.value = 0n;
  }

  async function switchOrAddNetwork(
    targetConfig: NetworkConfig = ROBINHOOD_CHAIN,
  ): Promise<boolean> {
    error.value = null;
    const provider = walletProvider.value ?? getInjectedProvider();
    if (!provider) {
      walletChainId.value = targetConfig.chainId;
      return true;
    }

    const hexChainId = `0x${targetConfig.chainId.toString(16)}`;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      walletChainId.value = targetConfig.chainId;
      await syncBalance();
      return true;
    } catch (switchError: unknown) {
      const err = switchError as { code?: number };
      if (err.code === 4902 || err.code === -32603) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: targetConfig.name,
                nativeCurrency: targetConfig.nativeCurrency,
                rpcUrls: [targetConfig.rpcUrl],
                blockExplorerUrls: [targetConfig.blockExplorer],
              },
            ],
          });
          walletChainId.value = targetConfig.chainId;
          await syncBalance();
          return true;
        } catch (addError) {
          error.value = (addError as Error).message;
          return false;
        }
      }
      error.value = (switchError as Error).message;
      return false;
    }
  }

  let crossTabSyncCleanup: (() => void) | null = null;

  function setupCrossTabSync() {
    if (typeof window === 'undefined') return;

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

  watch(walletAddress, (next, prev) => {
    if (next && next !== prev) {
      syncBalance(next);
    } else if (!next) {
      balanceWei.value = 0n;
    }
  });

  if (appKitConfigured) {
    watch(
      () => account.value.address,
      (next, prev) => {
        if (next && next !== prev) {
          const address = next as `0x${string}`;
          const currentProvider =
            (providerState.walletProvider as unknown as WalletProviderLike) ??
            getInjectedProvider();
          const currentChain = parseChainId(network.value.chainId) ?? ROBINHOOD_CHAIN.chainId;

          if (currentProvider) {
            setConnectedWallet(currentProvider, address, currentChain, 'appkit');
          } else {
            walletAddress.value = address;
            walletChainId.value = currentChain;
          }
          syncBalance(address);
        } else if (!next) {
          clearWalletState();
        }
      },
    );

    watch(
      () => providerState.walletProvider,
      (next) => {
        if (next && walletAddress.value) {
          const p = next as unknown as WalletProviderLike;
          walletProvider.value = p;
          bindProviderListeners(p);
        }
      },
    );

    watch(
      () => network.value.chainId,
      (next) => {
        const parsed = parseChainId(next);
        if (parsed !== null) {
          walletChainId.value = parsed;
        }
      },
    );
  }

  return {
    account: walletAddress,
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
