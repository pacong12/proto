import { computed, ref, shallowRef } from 'vue';
import {
  detectSolanaWallets,
  getSolanaProvider,
  type InjectedSolanaProvider,
  type SolanaWalletOption,
} from '../chains/solana/solana-wallet';
import { shortenAddress } from '../lib/utils';

const STORAGE_KEY = 'proto_solana_wallet_v1';

// Module-level state so every component shares one Solana connection.
const address = ref<string | null>(null);
const walletId = ref<SolanaWalletOption['id'] | null>(null);
const provider = shallowRef<InjectedSolanaProvider | null>(null);
const connecting = ref(false);
const error = ref<string | null>(null);

function readStoredWallet(): SolanaWalletOption['id'] | null {
  try {
    return (localStorage.getItem(STORAGE_KEY) as SolanaWalletOption['id'] | null) ?? null;
  } catch {
    return null;
  }
}

function writeStoredWallet(id: SolanaWalletOption['id'] | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode); the session simply will not auto-reconnect.
  }
}

function handleDisconnect() {
  address.value = null;
  walletId.value = null;
  provider.value = null;
}

function handleAccountChanged(next: unknown) {
  const key = next as { toBase58?: () => string } | null;
  if (key?.toBase58) address.value = key.toBase58();
  else handleDisconnect();
}

function attach(id: SolanaWalletOption['id'], injected: InjectedSolanaProvider, pubkey: string) {
  provider.value?.off?.('disconnect', handleDisconnect);
  provider.value?.off?.('accountChanged', handleAccountChanged);
  provider.value = injected;
  walletId.value = id;
  address.value = pubkey;
  injected.on?.('disconnect', handleDisconnect);
  injected.on?.('accountChanged', handleAccountChanged);
}

export function useSolanaWallet() {
  const wallets = computed(() => detectSolanaWallets());
  const isConnected = computed(() => address.value !== null);
  const formattedAddress = computed(() => shortenAddress(address.value));

  async function connect(id: SolanaWalletOption['id'], options: { silent?: boolean } = {}) {
    const injected = getSolanaProvider(id);
    if (!injected) {
      error.value = 'Wallet not detected. Install it or open this page in the wallet browser.';
      return false;
    }
    connecting.value = true;
    error.value = null;
    try {
      const response = await injected.connect(options.silent ? { onlyIfTrusted: true } : undefined);
      const key = (response && response.publicKey) || injected.publicKey;
      if (!key) throw new Error('Wallet did not return a public key');
      attach(id, injected, key.toBase58());
      writeStoredWallet(id);
      return true;
    } catch (err) {
      if (!options.silent) error.value = (err as Error)?.message || 'Failed to connect wallet';
      return false;
    } finally {
      connecting.value = false;
    }
  }

  async function disconnect() {
    try {
      await provider.value?.disconnect();
    } catch {
      // Some wallets throw when already disconnected; state is cleared regardless.
    }
    writeStoredWallet(null);
    handleDisconnect();
  }

  /** Reconnect silently to the last used wallet if the user already trusted this site. */
  async function restore() {
    const stored = readStoredWallet();
    if (stored && !address.value) await connect(stored, { silent: true });
  }

  return {
    wallets,
    address,
    walletId,
    provider,
    connecting,
    error,
    isConnected,
    formattedAddress,
    connect,
    disconnect,
    restore,
  };
}
