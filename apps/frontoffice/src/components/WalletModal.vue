<template>
  <div
    class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4"
    @click.self="close"
  >
    <Card
      class="w-[calc(100vw-2rem)] sm:w-full max-w-md max-h-[90vh] shadow-2xl overflow-hidden p-0 border-border bg-card text-foreground rounded-2xl flex flex-col transition-all duration-200"
    >
      <!-- Header with Dynamic Title & Clean X Button -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 class="text-sm font-bold font-heading">
          {{ isConnected ? t('switchManageWallet') : t('connectWallet') }}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-5 w-5 p-0 text-rose-400 hover:text-rose-600 cursor-pointer ml-2 rounded"
          @click="error = null"
        >
          &times;
        </Button>
      </div>

      <div class="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        <!-- 1. Active Connected Wallet Details (Shown when Connected) -->
        <div
          v-if="isConnected && account"
          class="p-4 rounded-xl bg-muted/30 border border-border space-y-3"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-semibold"
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
                <span class="font-mono text-xs font-bold block truncate text-foreground">
                  {{ account }}
                </span>
                <span class="font-mono text-[11px] text-foreground font-semibold">
                  {{ formattedBalance }}
                </span>
              </div>
            </div>

            <!-- Copy Button -->
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2 text-xs gap-1 border-border shrink-0 cursor-pointer"
              @click="copyAddress"
              :title="copied ? t('addressCopied') : t('copyAddress')"
            >
              <Check v-if="copied" class="w-3 h-3 text-foreground" />
              <Copy v-else class="w-3 h-3" />
              <span class="text-[10px] font-mono">{{ copied ? 'Copied' : 'Copy' }}</span>
            </Button>
          </div>

          <!-- Action Buttons: Switch Network / Disconnect -->
          <div class="flex items-center justify-between pt-2 border-t border-border gap-2">
            <Button
              v-if="!isCorrectNetwork"
              variant="destructive"
              size="sm"
              class="h-7 text-xs font-semibold flex-1 cursor-pointer"
              @click="switchOrAddNetwork()"
            >
              Switch Network
            </Button>

            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1.5 ml-auto cursor-pointer"
              @click="handleDisconnect"
            >
              <LogOut class="w-3.5 h-3.5" />
              <span>{{ t('disconnect') }}</span>
            </Button>
          </div>

          <!-- Multi-Chain Network Selector (Robinhood & Arc) with Shadcn Select -->
          <div class="space-y-1.5 pt-2 border-t border-border">
            <span
              class="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block"
            >
              Active Network
            </span>
            <Select
              :model-value="String(activeNetwork.chainId)"
              @update:model-value="handleChainSelect"
            >
              <SelectTrigger
                class="w-full h-10 px-3 justify-between font-mono text-xs border-border hover:bg-muted cursor-pointer"
              >
                <div class="flex items-center gap-2.5 truncate">
                  <img
                    :src="
                      activeNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'
                    "
                    :alt="activeNetwork.name"
                    class="w-4 h-4 rounded-xs object-contain shrink-0"
                  />
                  <span class="font-bold text-foreground">{{ activeNetwork.name }}</span>
                </div>
              </SelectTrigger>
              <SelectContent
                align="start"
                class="w-[--radix-select-trigger-width] min-w-[280px] bg-card border border-border p-1.5 shadow-lg"
              >
                <SelectLabel
                  class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1"
                >
                  Select Network
                </SelectLabel>
                <SelectSeparator class="border-border" />
                <SelectItem
                  v-for="net in Object.values(SUPPORTED_CHAINS)"
                  :key="net.chainId"
                  :value="String(net.chainId)"
                  class="cursor-pointer text-xs font-mono py-2.5 px-2.5 hover:bg-muted rounded-lg transition"
                >
                  <div class="flex items-center gap-2.5">
                    <img
                      :src="net.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
                      :alt="net.name"
                      class="w-5 h-5 rounded-md object-contain shrink-0"
                    />
                    <span class="font-bold text-foreground leading-tight">
                      {{ net.name }}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- 2. Detected Wallet Providers Section -->
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span
              class="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-semibold"
            >
              {{ isConnected ? 'Switch Provider' : 'Available Wallets' }}
            </span>
            <span
              v-if="scanning"
              class="text-[10px] font-mono text-muted-foreground flex items-center gap-1"
            >
              <Loader2 class="w-3 h-3 animate-spin text-foreground" />
              <span>{{ t('scanningForWallets') }}</span>
            </span>
          </div>

          <ul class="space-y-1.5">
            <li v-for="wallet in wallets" :key="wallet.id">
              <Button
                variant="outline"
                class="w-full justify-between h-auto px-3.5 py-2.5 rounded-xl border-border hover:border-foreground/40 hover:bg-muted transition-all cursor-pointer"
                :disabled="connectingId === wallet.id"
                :aria-label="`Connect with ${wallet.name}`"
                @click="connect(wallet)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <Avatar class="w-8 h-8 rounded-lg shrink-0 border border-border">
                    <AvatarImage v-if="wallet.icon" :src="wallet.icon" :alt="wallet.name" />
                    <AvatarFallback class="bg-muted text-foreground font-bold text-xs">
                      {{ wallet.name.slice(0, 2).toUpperCase() }}
                    </AvatarFallback>
                  </Avatar>

                  <div class="text-left truncate">
                    <span class="text-xs font-semibold block truncate text-foreground">
                      {{ wallet.name }}
                    </span>
                    <span class="block text-[10px] font-mono text-muted-foreground truncate">
                      {{ wallet.rdns ?? 'Browser extension' }}
                    </span>
                  </div>
                </div>

                <div class="shrink-0 flex items-center gap-2">
                  <span
                    v-if="isWalletActive(wallet)"
                    class="text-[10px] font-mono font-bold text-foreground bg-muted border border-border px-2 py-0.5 rounded-full"
                  >
                    Active
                  </span>

                  <span
                    v-else-if="connectingId === wallet.id"
                    class="text-xs text-foreground font-mono flex items-center gap-1"
                  >
                    <Loader2 class="w-3 h-3 animate-spin" />
                    <span>{{ t('connecting') }}</span>
                  </span>
                </div>
              </Button>
            </li>

            <li
              v-if="wallets.length === 0 && !scanning"
              class="px-4 py-6 text-center text-xs text-muted-foreground font-mono bg-muted/30 rounded-xl border border-dashed border-border"
            >
              No browser wallets detected. Please install MetaMask, Rabby, or Coinbase Wallet.
            </li>
          </ul>
        </div>

        <!-- Social & Email Login (Reown AppKit) -->
        <div v-if="appKitConfigured" class="space-y-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            class="w-full justify-center h-10 px-3.5 text-xs font-semibold rounded-xl border-border hover:border-foreground/40 hover:bg-muted transition-all cursor-pointer gap-2"
            @click="openAppKitSocial"
          >
            <Mail class="w-4 h-4 text-foreground" />
            <span>Social & Email Login (Google, X, Apple)</span>
          </Button>
        </div>
      </div>

      <!-- AppKit Notice Footer -->
      <div
        v-if="!appKitConfigured"
        class="px-5 py-2.5 border-t border-border bg-muted/30 text-[11px] text-muted-foreground leading-relaxed font-mono"
      >
        <span>EIP-6963 multi-wallet discovery active.</span>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Loader2, X, Copy, Check, LogOut, ChevronDown, Mail } from 'lucide-vue-next';
import { ROBINHOOD_CHAIN, SUPPORTED_CHAINS } from '@proto/shared-types';
import { useAppKit } from '@reown/appkit/vue';
import { appKitConfigured } from '../lib/appkit';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '../composables/useWallet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage, Jazzicon } from '@/components/ui/avatar';
import Select from '@/components/ui/select/Select.vue';
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue';
import SelectContent from '@/components/ui/select/SelectContent.vue';
import SelectItem from '@/components/ui/select/SelectItem.vue';
import SelectLabel from '@/components/ui/select/SelectLabel.vue';
import SelectSeparator from '@/components/ui/select/SelectSeparator.vue';
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

function handleChainSelect(val: unknown) {
  const chainId = Number(val);
  const target = SUPPORTED_CHAINS[chainId];
  if (target) {
    switchOrAddNetwork(target);
  }
}

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
const appKit = appKitConfigured ? useAppKit() : null;

async function openAppKitSocial() {
  close();
  if (appKit) {
    try {
      await appKit.open();
    } catch (e) {
      console.warn('[WalletModal] Failed to open AppKit:', e);
    }
  }
}

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
  if (typeof window === 'undefined') return;

  const win = window as unknown as Record<string, unknown>;

  // 1. Bitget / BitKeep specific injection
  const bitget =
    (win.bitget as { ethereum?: WalletProviderLike } | undefined)?.ethereum ||
    (win.bitkeep as { ethereum?: WalletProviderLike } | undefined)?.ethereum;
  if (bitget) {
    addWallet({
      id: 'com.bitget.web3',
      name: 'Bitget Wallet',
      provider: bitget,
    });
  }

  // 2. OKX specific injection
  const okx = win.okxwallet as WalletProviderLike | undefined;
  if (okx) {
    addWallet({
      id: 'com.okex.wallet',
      name: 'OKX Wallet',
      provider: okx,
    });
  }

  // 3. Multi-provider array in window.ethereum
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
    for (const p of eth.providers) {
      if (p.isBitKeep || p.isBitget) {
        addWallet({ id: 'com.bitget.web3', name: 'Bitget Wallet', provider: p });
      } else if (p.isOkxWallet) {
        addWallet({ id: 'com.okex.wallet', name: 'OKX Wallet', provider: p });
      } else if (p.isMetaMask) {
        addWallet({ id: 'io.metamask', name: 'MetaMask', provider: p });
      }
    }
  } else if (eth) {
    const rawEth = eth as unknown as {
      isOkxWallet?: boolean;
      isBitKeep?: boolean;
      isBitget?: boolean;
    };
    const name = rawEth.isOkxWallet
      ? 'OKX Wallet'
      : rawEth.isBitKeep || rawEth.isBitget
        ? 'Bitget Wallet'
        : 'MetaMask / Injected Wallet';
    const id = rawEth.isOkxWallet
      ? 'com.okex.wallet'
      : rawEth.isBitKeep || rawEth.isBitget
        ? 'com.bitget.web3'
        : 'window.ethereum';
    addWallet({
      id,
      name,
      provider: eth,
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
