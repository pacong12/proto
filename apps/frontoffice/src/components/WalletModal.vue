<template>
  <div
    class="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    @click.self="close"
  >
    <Card class="w-full max-w-sm shadow-2xl overflow-hidden p-0 border-zinc-800">
      <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 class="text-sm font-semibold">{{ t('connectWallet') }}</h2>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-xs leading-none"
          @click="close"
          title="Close"
        >
          &times;
        </Button>
      </div>

      <p v-if="error" class="px-5 pt-3 text-xs text-rose-400">{{ error }}</p>

      <ul class="p-3 max-h-80 overflow-y-auto space-y-1">
        <li v-for="wallet in wallets" :key="wallet.id">
          <Button
            variant="ghost"
            class="w-full justify-start h-auto px-3 py-2.5 rounded-xl gap-3 cursor-pointer"
            :disabled="connectingId === wallet.id"
            :aria-label="`Connect with ${wallet.name}`"
            @click="connect(wallet)"
          >
            <Avatar class="w-8 h-8 rounded-full">
              <AvatarImage v-if="wallet.icon" :src="wallet.icon" :alt="wallet.name" />
              <AvatarFallback class="bg-zinc-800 text-emerald-400 font-bold text-xs">
                {{ wallet.name.slice(0, 2).toUpperCase() }}
              </AvatarFallback>
            </Avatar>

            <span class="flex-1 text-left">
              <span class="text-xs font-medium block">{{ wallet.name }}</span>
              <span class="block text-[11px] font-normal">
                {{ wallet.rdns ?? 'Browser extension' }}
              </span>
            </span>

            <span v-if="connectingId === wallet.id" class="text-xs text-emerald-400 font-mono">
              {{ t('connecting') }}
            </span>
          </Button>
        </li>

        <li v-if="wallets.length === 0 && !scanning" class="px-3 py-6 text-center text-xs">
          No injected wallets found. Install MetaMask, Rabby, or Coinbase Wallet to continue.
        </li>
        <li
          v-if="scanning"
          class="px-3 py-6 text-center text-xs flex items-center justify-center gap-2"
        >
          <Loader2 class="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>{{ t('scanningForWallets') }}</span>
        </li>
      </ul>

      <div v-if="!appKitConfigured" class="px-5 py-3 border-t border-zinc-800 bg-zinc-950/50">
        <p class="text-[11px] leading-relaxed">
          Showing browser wallets. Set
          <code class="px-1 py-0.5 rounded bg-zinc-900 font-mono">VITE_REOWN_PROJECT_ID</code> in
          <code class="px-1 py-0.5 rounded bg-zinc-900 font-mono">apps/frontoffice/.env</code> to
          enable full Reown AppKit.
        </p>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import { ROBINHOOD_CHAIN, SUPPORTED_CHAINS } from '@proto/shared-types';
import { appKitConfigured } from '../lib/appkit';
import { useI18n } from '@/lib/i18n';

const { t } = useI18n();
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  setConnectedWallet,
  walletModalOpen,
  type WalletCandidate,
  type WalletProviderLike,
} from '../lib/wallet-store';

const wallets = ref<WalletCandidate[]>([]);
const scanning = ref(true);
const connectingId = ref<string | null>(null);
const error = ref<string | null>(null);

interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: WalletProviderLike;
}

const listeners: Array<() => void> = [];
let scanTimer: ReturnType<typeof setTimeout> | null = null;

function addWallet(candidate: WalletCandidate) {
  if (!wallets.value.some((w) => w.id === candidate.id)) {
    wallets.value.push(candidate);
    scanning.value = false;
  }
}

function collectInjectedWallet() {
  if (typeof window !== 'undefined' && 'ethereum' in window && window.ethereum) {
    const provider = window.ethereum as unknown as WalletProviderLike;
    addWallet({
      id: 'window.ethereum',
      name: 'MetaMask / Injected Wallet',
      provider,
    });
  }
}

function scanEip6963() {
  if (typeof window === 'undefined') return;

  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (detail?.info && detail.provider) {
      addWallet({
        id: detail.info.rdns || detail.info.uuid,
        name: detail.info.name,
        icon: detail.info.icon,
        rdns: detail.info.rdns,
        provider: detail.provider,
      });
    }
  };

  window.addEventListener('eip6963:announceProvider', onAnnounce);
  listeners.push(() => window.removeEventListener('eip6963:announceProvider', onAnnounce));
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

async function connect(wallet: WalletCandidate) {
  connectingId.value = wallet.id;
  error.value = null;
  try {
    const accounts = (await wallet.provider.request({
      method: 'eth_requestAccounts',
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No account selected in the wallet');
    }

    const address = accounts[0] as `0x${string}`;
    const rawChainId = (await wallet.provider.request({
      method: 'eth_chainId',
    })) as string;
    const currentChainId = Number.parseInt(rawChainId, 16);

    let finalChainId = currentChainId;
    if (!SUPPORTED_CHAINS[currentChainId]) {
      await ensureRobinhoodChain(wallet.provider);
      finalChainId = ROBINHOOD_CHAIN.chainId;
    }

    setConnectedWallet(wallet.provider, address, finalChainId, wallet.id);
    close();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    connectingId.value = null;
  }
}

async function ensureRobinhoodChain(provider: WalletProviderLike) {
  const hexChainId = `0x${ROBINHOOD_CHAIN.chainId.toString(16)}`;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (switchErr) {
    const code = (switchErr as { code?: number }).code;
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexChainId,
            chainName: ROBINHOOD_CHAIN.name,
            nativeCurrency: ROBINHOOD_CHAIN.nativeCurrency,
            rpcUrls: [ROBINHOOD_CHAIN.rpcUrl],
            blockExplorerUrls: [ROBINHOOD_CHAIN.blockExplorer],
          },
        ],
      });
    } else {
      throw switchErr;
    }
  }
}

function close() {
  walletModalOpen.value = false;
  scanning.value = false;
}

onMounted(() => {
  collectInjectedWallet();
  scanEip6963();
  scanTimer = setTimeout(() => {
    scanning.value = false;
  }, 1200);
});

onUnmounted(() => {
  if (scanTimer) clearTimeout(scanTimer);
  listeners.forEach((remove) => remove());
});
</script>
