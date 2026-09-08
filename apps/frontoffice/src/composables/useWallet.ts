import { ref, computed, onMounted, getCurrentInstance } from 'vue';
import { ROBINHOOD_CHAIN, ROBINHOOD_TESTNET, type NetworkConfig } from '@proto/shared-types';
import { publicClient } from '../lib/viem-client';

interface EthereumProvider {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
}

const account = ref<`0x${string}` | null>(null);
const chainId = ref<number | null>(null);
const balanceWei = ref<bigint>(0n);
const isConnecting = ref(false);
const error = ref<string | null>(null);

export function useWallet() {
  const isConnected = computed(() => account.value !== null);

  const formattedAddress = computed(() => {
    if (!account.value) return '';
    return `${account.value.slice(0, 6)}...${account.value.slice(-4)}`;
  });

  const formattedBalance = computed(() => {
    const eth = Number(balanceWei.value) / 1e18;
    return `${eth.toFixed(4)} ETH`;
  });

  const isCorrectNetwork = computed(() => {
    return chainId.value === ROBINHOOD_CHAIN.chainId || chainId.value === ROBINHOOD_TESTNET.chainId;
  });

  const activeNetwork = computed((): NetworkConfig => {
    if (chainId.value === ROBINHOOD_TESTNET.chainId) {
      return ROBINHOOD_TESTNET;
    }
    return ROBINHOOD_CHAIN;
  });

  function getProvider(): EthereumProvider | null {
    if (typeof window !== 'undefined' && 'ethereum' in window && window.ethereum) {
      return window.ethereum as EthereumProvider;
    }
    return null;
  }

  async function updateBalance(address: `0x${string}`) {
    try {
      balanceWei.value = await publicClient.getBalance({ address });
    } catch {
      balanceWei.value = 0n;
    }
  }

  async function switchOrAddNetwork(
    targetConfig: NetworkConfig = ROBINHOOD_CHAIN,
  ): Promise<boolean> {
    const provider = getProvider();
    if (!provider) return false;

    const hexChainId = `0x${targetConfig.chainId.toString(16)}`;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      chainId.value = targetConfig.chainId;
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
          chainId.value = targetConfig.chainId;
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

  async function connectWallet(): Promise<`0x${string}` | null> {
    const provider = getProvider();
    if (!provider) {
      error.value =
        'No Ethereum Web3 wallet found. Please install MetaMask, Rabby, or Coinbase Wallet.';
      return null;
    }

    isConnecting.value = true;
    error.value = null;

    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected');
      }

      const activeAccount = accounts[0] as `0x${string}`;
      account.value = activeAccount;

      const rawChainId = (await provider.request({
        method: 'eth_chainId',
      })) as string;
      chainId.value = parseInt(rawChainId, 16);

      if (!isCorrectNetwork.value) {
        await switchOrAddNetwork(ROBINHOOD_CHAIN);
      }

      await updateBalance(activeAccount);
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem('proto_wallet_connected', 'true');
      }

      setupEventListeners(provider);

      return activeAccount;
    } catch (err) {
      error.value = (err as Error).message;
      return null;
    } finally {
      isConnecting.value = false;
    }
  }

  function disconnectWallet() {
    account.value = null;
    chainId.value = null;
    balanceWei.value = 0n;
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      localStorage.removeItem('proto_wallet_connected');
    }
  }

  function setupEventListeners(provider: EthereumProvider) {
    if (provider.on) {
      provider.on('accountsChanged', (accounts: unknown) => {
        const accs = accounts as string[];
        if (accs.length === 0) {
          disconnectWallet();
        } else {
          account.value = accs[0] as `0x${string}`;
          updateBalance(account.value);
        }
      });

      provider.on('chainChanged', (newChainIdHex: unknown) => {
        chainId.value = parseInt(newChainIdHex as string, 16);
        if (account.value) {
          updateBalance(account.value);
        }
      });

      provider.on('disconnect', () => {
        disconnectWallet();
      });
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      if (
        typeof window !== 'undefined' &&
        'localStorage' in window &&
        localStorage.getItem('proto_wallet_connected') === 'true'
      ) {
        const provider = getProvider();
        if (provider) {
          provider
            .request({ method: 'eth_accounts' })
            .then((accounts) => {
              const accs = accounts as string[];
              if (accs && accs.length > 0) {
                account.value = accs[0] as `0x${string}`;
                provider
                  .request({ method: 'eth_chainId' })
                  .then((rawChain) => {
                    chainId.value = parseInt(rawChain as string, 16);
                  })
                  .catch(() => {});
                updateBalance(account.value);
                setupEventListeners(provider);
              }
            })
            .catch(() => {});
        }
      }
    });
  }

  return {
    account,
    chainId,
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
    updateBalance,
  };
}
