<template>
  <div
    class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4"
    @click.self="close"
  >
    <Card
      class="w-full max-w-md shadow-2xl overflow-hidden p-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-black dark:text-white rounded-2xl"
    >
      <!-- Header with Dynamic Title & Clean X Button -->
      <div
        class="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800"
      >
        <h2 class="text-sm font-bold font-heading">
          {{ isConnected ? t('switchManageWallet') : t('connectWallet') }}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
          @click="close"
          title="Close"
          aria-label="Close modal"
        >
          <X class="w-4 h-4" />
        </Button>
      </div>

      <!-- Error Notification Banner -->
      <div
        v-if="error"
        class="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between"
      >
        <span>{{ error }}</span>
        <button
          type="button"
          class="text-rose-400 hover:text-rose-600 cursor-pointer ml-2"
          @click="error = null"
        >
          &times;
        </button>
      </div>

      <div class="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        <!-- 1. Active Connected Wallet Details (Shown when Connected) -->
        <div
          v-if="isConnected && account"
          class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold"
            >
              {{ t('connectedAccount') }}
            </span>
            <Badge
              :variant="isCorrectNetwork ? 'default' : 'destructive'"
              class="text-[10px] font-mono"
            >
              {{ isCorrectNetwork ? activeNetwork.name : t('switchToRobinhood') }}
            </Badge>
          </div>

          <!-- Address & Jazzicon Row -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <Jazzicon :address="account" :size="24" class="rounded-full shrink-0" />
              <div class="truncate">
                <span class="font-mono text-xs font-bold block truncate text-black dark:text-white">
                  {{ account }}
                </span>
                <span
                  class="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold"
                >
                  {{ formattedBalance }}
                </span>
              </div>
            </div>

            <!-- Copy Button -->
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2 text-xs gap-1 border-zinc-300 dark:border-zinc-700 shrink-0 cursor-pointer"
              @click="copyAddress"
              :title="copied ? t('addressCopied') : t('copyAddress')"
            >
              <Check v-if="copied" class="w-3 h-3 text-emerald-500" />
              <Copy v-else class="w-3 h-3" />
              <span class="text-[10px] font-mono">{{ copied ? 'Copied' : 'Copy' }}</span>
            </Button>
          </div>

          <!-- Action Buttons: Switch Network / Disconnect -->
          <div
            class="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 gap-2"
          >
            <Button
              v-if="!isCorrectNetwork"
              variant="destructive"
              size="sm"
              class="h-7 text-xs font-semibold flex-1 cursor-pointer"
              @click="switchOrAddNetwork()"
            >
              {{ t('switchToRobinhood') }}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5 ml-auto cursor-pointer"
              @click="handleDisconnect"
            >
              <LogOut class="w-3.5 h-3.5" />
              <span>{{ t('disconnect') }}</span>
            </Button>
          </div>
        </div>

        <!-- 2. Detected Wallet Providers Section -->
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span
              class="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold"
            >
              {{ isConnected ? 'Switch Provider' : 'Available Wallets' }}
            </span>
            <span
              v-if="scanning"
              class="text-[10px] font-mono text-zinc-400 flex items-center gap-1"
            >
              <Loader2 class="w-3 h-3 animate-spin text-emerald-500" />
              <span>{{ t('scanningForWallets') }}</span>
            </span>
          </div>

          <ul class="space-y-1.5">
            <li v-for="wallet in wallets" :key="wallet.id">
              <Button
                variant="outline"
                class="w-full justify-between h-auto px-3.5 py-2.5 rounded-xl border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer"
                :disabled="connectingId === wallet.id"
                :aria-label="`Connect with ${wallet.name}`"
                @click="connect(wallet)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <Avatar
                    class="w-8 h-8 rounded-lg shrink-0 border border-zinc-200 dark:border-zinc-800"
                  >
                    <AvatarImage v-if="wallet.icon" :src="wallet.icon" :alt="wallet.name" />
                    <AvatarFallback
                      class="bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-bold text-xs"
                    >
                      {{ wallet.name.slice(0, 2).toUpperCase() }}
                    </AvatarFallback>
                  </Avatar>

                  <div class="text-left truncate">
                    <span class="text-xs font-semibold block truncate text-black dark:text-white">
                      {{ wallet.name }}
                    </span>
                    <span class="block text-[10px] font-mono text-zinc-400 truncate">
                      {{ wallet.rdns ?? 'Browser extension' }}
                    </span>
                  </div>
                </div>

                <div class="shrink-0 flex items-center gap-2">
                  <span
                    v-if="isWalletActive(wallet)"
                    class="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full"
                  >
                    Active
                  </span>

                  <span
                    v-else-if="connectingId === wallet.id"
                    class="text-xs text-emerald-500 font-mono flex items-center gap-1"
                  >
                    <Loader2 class="w-3 h-3 animate-spin" />
                    <span>{{ t('connecting') }}</span>
                  </span>
                </div>
              </Button>
            </li>

            <li
              v-if="wallets.length === 0 && !scanning"
              class="px-4 py-6 text-center text-xs text-zinc-500 font-mono bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800"
            >
              No browser wallets detected. Please install MetaMask, Rabby, or Coinbase Wallet.
            </li>
          </ul>
        </div>
      </div>

      <!-- AppKit Notice Footer -->
      <div
        v-if="!appKitConfigured"
        class="px-5 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-[11px] text-zinc-500 leading-relaxed font-mono"
      >
        <span>EIP-6963 multi-wallet discovery active.</span>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Loader2, X, Copy, Check, LogOut } from 'lucide-vue-next';
import { ROBINHOOD_CHAIN, SUPPORTED_CHAINS } from '@proto/shared-types';
import { appKitConfigured } from '../lib/appkit';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '../composables/useWallet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage, Jazzicon } from '@/components/ui/avatar';
import {
  setConnectedWallet,
  walletModalOpen,
  walletProviderId,
  type WalletCandidate,
  type WalletProviderLike,
} from '../lib/wallet-store';

const { t } = useI18n();

const {
  account,
  isConnected,
  isCorrectNetwork,
  formattedBalance,
  activeNetwork,
  disconnectWallet,
  switchOrAddNetwork,
} = useWallet();

const wallets = ref<WalletCandidate[]>([]);
const scanning = ref(true);
const connectingId = ref<string | null>(null);
const error = ref<string | null>(null);
const copied = ref(false);

interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: WalletProviderLike;
}

const listeners: Array<() => void> = [];
let scanTimer: ReturnType<typeof setTimeout> | null = null;

function isWalletActive(wallet: WalletCandidate): boolean {
  if (!isConnected.value) return false;
  if (walletProviderId.value) {
    return wallet.id === walletProviderId.value;
  }
  return wallet.id === 'window.ethereum';
}

function copyAddress() {
  if (account.value) {
    navigator.clipboard.writeText(account.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}

async function handleDisconnect() {
  await disconnectWallet();
  close();
}

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

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close();
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
  }
  collectInjectedWallet();
  scanEip6963();
  scanTimer = setTimeout(() => {
    scanning.value = false;
  }, 1200);
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown);
  }
  if (scanTimer) clearTimeout(scanTimer);
  listeners.forEach((remove) => remove());
});
</script>
