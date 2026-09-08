import { computed, onMounted, ref, watch } from 'vue';
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useDisconnect,
} from '@reown/appkit/vue';
import type { EIP1193Provider } from 'viem';
import { ROBINHOOD_CHAIN, ROBINHOOD_TESTNET, type NetworkConfig } from '@proto/shared-types';
import { publicClient } from '../lib/viem-client';
import { appKitConfigured } from '../lib/appkit';
import {
  bindProviderListeners,
  clearWalletState,
  isStoredConnectionActive,
  setConnectedWallet,
  walletAddress,
  walletChainId,
  walletModalOpen,
  walletProvider,
  type WalletProviderLike,
} from '../lib/wallet-store';

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
    if (!walletAddress.value) return '';
    return `${walletAddress.value.slice(0, 6)}...${walletAddress.value.slice(-4)}`;
  });

  const formattedBalance = computed(() => {
    const eth = Number(balanceWei.value) / 1e18;
    return `${eth.toFixed(4)} ETH`;
  });

  const isConnected = computed(() => walletAddress.value !== null);

  const isCorrectNetwork = computed(() => {
    return (
      walletChainId.value === ROBINHOOD_CHAIN.chainId ||
      walletChainId.value === ROBINHOOD_TESTNET.chainId
    );
  });

  const activeNetwork = computed((): NetworkConfig => {
    if (walletChainId.value === ROBINHOOD_TESTNET.chainId) return ROBINHOOD_TESTNET;
    return ROBINHOOD_CHAIN;
  });

  async function syncBalance(addressValue?: `0x${string}`) {
    const target = addressValue ?? walletAddress.value;
    if (!target) {
      balanceWei.value = 0n;
      return;
    }
    try {
      balanceWei.value = await publicClient.getBalance({ address: target });
    } catch {
      balanceWei.value = 0n;
    }
  }

  function getInjectedProvider(): WalletProviderLike | null {
    if (typeof window !== 'undefined' && 'ethereum' in window && window.ethereum) {
      return window.ethereum as unknown as WalletProviderLike;
    }
    return null;
  }

  async function tryAutoReconnectInjected() {
    if (walletAddress.value || !isStoredConnectionActive()) return;

    const provider = getInjectedProvider();
    if (!provider) return;

    try {
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (accounts && accounts.length > 0) {
        const address = accounts[0] as `0x${string}`;
        const rawChain = await provider.request({ method: 'eth_chainId' });
        const chain = parseChainId(rawChain) ?? ROBINHOOD_CHAIN.chainId;

        setConnectedWallet(provider, address, chain, 'window.ethereum');
        await syncBalance(address);
      } else {
        clearWalletState();
      }
    } catch {
      clearWalletState();
    }
  }

  async function openWallet() {
    error.value = null;
    if (appKitConfigured && appKit) {
      try {
        await appKit.open();
        return;
      } catch (openErr) {
        // If AppKit modal fails, fall back to local modal
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
      await openWallet();
      return false;
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

  onMounted(() => {
    if (walletAddress.value) {
      syncBalance(walletAddress.value);
    } else {
      tryAutoReconnectInjected();
    }
  });

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
