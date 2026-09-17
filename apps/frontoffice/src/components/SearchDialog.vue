<template>
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-20 bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4"
    @click.self="$emit('close')"
  >
    <Card
      class="w-[calc(100vw-2rem)] sm:w-full max-w-2xl sm:max-w-3xl shadow-2xl overflow-hidden p-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl flex flex-col transition-all duration-200"
    >
      <!-- Search Input Header -->
      <div
        class="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800"
      >
        <Search class="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
        <Input
          ref="searchInput"
          v-model="query"
          type="text"
          :placeholder="
            t('searchPlaceholder') ||
            'Search tokens by name, ticker, contract address, or 0x tx hash...'
          "
          class="border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 bg-transparent h-10 text-sm sm:text-base px-0 text-black dark:text-white placeholder:text-zinc-400"
          @keydown.esc="$emit('close')"
          @keydown="handleKeydown"
        />
        <Badge
          variant="outline"
          class="font-mono text-[10px] cursor-pointer border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-black dark:hover:text-white"
          @click="$emit('close')"
        >
          ESC
        </Badge>
      </div>

      <!-- Search Results List -->
      <div class="max-h-[30rem] overflow-y-auto p-3">
        <div
          v-if="loading || searchingTx"
          class="flex items-center justify-center py-10 text-xs gap-2 text-zinc-500 dark:text-zinc-400"
        >
          <Loader2 class="w-4 h-4 animate-spin text-emerald-500 dark:text-emerald-400" />
          <span>{{ searchingTx ? 'Searching transaction...' : t('searchingTokens') }}</span>
        </div>

        <!-- Matched Transaction Result Card -->
        <div
          v-if="matchedTrade && !searchingTx"
          class="mb-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 text-xs space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono uppercase font-bold text-zinc-400">
              Transaction Match
            </span>
            <Badge
              :variant="matchedTrade.isBuy ? 'default' : 'destructive'"
              class="text-[9px] uppercase px-1.5 py-0 font-mono"
            >
              {{ matchedTrade.isBuy ? 'BUY' : 'SELL' }}
            </Badge>
          </div>

          <div
            @click="selectToken(matchedTrade.tokenAddress)"
            class="flex items-center justify-between cursor-pointer group"
          >
            <div class="min-w-0 truncate">
              <span
                class="font-mono text-xs font-bold text-black dark:text-white group-hover:text-emerald-500 transition truncate block"
              >
                {{ shortenAddress(matchedTrade.transactionHash, 10, 8) }}
              </span>
              <p class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                Token: {{ shortenAddress(matchedTrade.tokenAddress) }} •
                {{ matchedTrade.tokenAmount }} tokens • {{ matchedTrade.wethAmount }}
                {{ activeNetwork.nativeCurrency.symbol }}
              </p>
            </div>

            <div class="flex items-center gap-2 shrink-0 ml-3">
              <a
                v-if="activeNetwork.blockExplorer"
                :href="`${activeNetwork.blockExplorer}/tx/${matchedTrade.transactionHash}`"
                target="_blank"
                rel="noopener noreferrer"
                class="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:text-emerald-400 text-zinc-500 transition"
                title="View on Explorer"
                @click.stop
              >
                <ExternalLink class="w-3.5 h-3.5" />
              </a>
              <span
                class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline"
              >
                View Token &rarr;
              </span>
            </div>
          </div>
        </div>

        <Empty
          v-else-if="filteredTokens.length === 0 && !matchedTrade && !searchingTx"
          :title="t('noTokensFound')"
          :description="query ? `${t('noMatchingTokens')} '${query}'` : t('typeSearchHint')"
          class="border-0 bg-transparent py-6"
        />

        <ul v-else class="space-y-1.5">
          <li v-for="(item, idx) in filteredTokens" :key="item.token.address">
            <Button
              variant="ghost"
              @click="selectToken(item.token.address)"
              :class="[
                'w-full h-auto flex items-center justify-between p-3 rounded-xl transition text-left group cursor-pointer border justify-start font-normal',
                idx === selectedIndex
                  ? 'bg-zinc-100 dark:bg-zinc-800/90 border-emerald-500/40 ring-1 ring-emerald-500/30'
                  : 'bg-zinc-50/50 dark:bg-zinc-900/30 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900',
              ]"
            >
              <div class="flex items-center gap-3.5 min-w-0">
                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="38"
                  :height="38"
                  :chain-badge="
                    activeNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'
                  "
                  :currency-badge="
                    activeNetwork.nativeCurrency.symbol === 'USDC'
                      ? '/tokens/usdc.svg'
                      : '/tokens/eth.svg'
                  "
                  class="rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0"
                />

                <div class="truncate">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-bold text-black dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition truncate"
                    >
                      {{ item.token.name }}
                    </span>
                    <span class="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      ${{ item.token.symbol }}
                    </span>
                    <Badge
                      :variant="item.token.version === 'v2' ? 'outline' : 'secondary'"
                      class="text-[9px] px-1 py-0 h-3.5 font-mono uppercase"
                    >
                      {{ item.token.version === 'v2' ? 'v2' : 'v1' }}
                    </Badge>
                  </div>
                  <p class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                    {{ item.token.address }}
                  </p>
                </div>
              </div>

              <div class="text-right shrink-0 font-mono text-xs ml-4 space-y-0.5">
                <span class="font-bold block text-black dark:text-white">
                  ${{ item.marketData.priceUsd.toFixed(8) }}
                </span>
                <div class="flex items-center justify-end gap-2 text-[11px]">
                  <span class="text-zinc-500 dark:text-zinc-400">
                    MCap: ${{ item.marketData.marketCapUsd.toLocaleString() }}
                  </span>
                  <span>•</span>
                  <span
                    :class="
                      item.marketData.isGraduated
                        ? 'text-emerald-500 dark:text-emerald-400 font-bold'
                        : 'text-zinc-500 dark:text-zinc-400'
                    "
                  >
                    {{
                      item.marketData.isGraduated
                        ? t('graduated')
                        : `${(item.marketData.graduationProgress * 100).toFixed(0)}%`
                    }}
                  </span>
                </div>
              </div>
            </Button>
          </li>
        </ul>
      </div>

      <!-- Quick Actions Footer with Light & Dark contrast -->
      <div
        class="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400"
      >
        <span>
          {{ t('navigateHint') }}:
          <kbd
            class="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1 py-0.5 rounded text-[10px]"
            >↑</kbd
          >
          <kbd
            class="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1 py-0.5 rounded text-[10px] ml-0.5"
            >↓</kbd
          >
        </span>
        <span>
          {{ t('selectHint') }}:
          <kbd
            class="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded text-[10px]"
            >ENTER</kbd
          >
        </span>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Search, Loader2, ExternalLink } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '@/composables/useWallet';
import { shortenAddress } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Empty } from '@/components/ui/empty';
import type { LaunchedTokenEntity, TokenMarketData, TradeEventEntity } from '@proto/shared-types';

const { t } = useI18n();
const { activeNetwork } = useWallet();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectToken', address: string): void;
}>();

const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const searchingTx = ref(false);
const matchedTrade = ref<TradeEventEntity | null>(null);
const tokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);
const selectedIndex = ref(0);

let txLookupDebounce: ReturnType<typeof setTimeout> | null = null;

watch(query, (val) => {
  selectedIndex.value = 0;
  matchedTrade.value = null;
  const q = val.trim();

  if (txLookupDebounce) clearTimeout(txLookupDebounce);

  // If query is a full 66-char transaction hash (0x + 64 hex chars)
  if (/^0x[a-fA-F0-9]{64}$/i.test(q)) {
    searchingTx.value = true;
    txLookupDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/trades/${q}`);
        const env = await res.json();
        if (env.success && env.data) {
          matchedTrade.value = env.data;
        }
      } catch {
        // Non-blocking
      } finally {
        searchingTx.value = false;
      }
    }, 200);
  }
});

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredTokens.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % filteredTokens.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredTokens.value.length > 0) {
      selectedIndex.value =
        (selectedIndex.value - 1 + filteredTokens.value.length) % filteredTokens.value.length;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (matchedTrade.value && filteredTokens.value.length === 0) {
      selectToken(matchedTrade.value.tokenAddress);
    } else if (filteredTokens.value[selectedIndex.value]) {
      selectToken(filteredTokens.value[selectedIndex.value].token.address);
    }
  }
}

onMounted(async () => {
  searchInput.value?.focus();
  loading.value = true;
  try {
    const res = await fetch('/api/tokens');
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      tokens.value = envelope.data;
    }
  } catch {
    // Non-blocking
  } finally {
    loading.value = false;
  }
});

const filteredTokens = computed(() => {
  const isArc = activeNetwork.value.chainId === 5042 || activeNetwork.value.chainId === 5042002;
  const arcWeth = '0x3600000000000000000000000000000000000000';
  const arcFactory = '0x48844223abdceeb1ce502f54d559681358e68200';

  const chainFiltered = tokens.value.filter((item) => {
    const paired = item.token.pairedToken?.toLowerCase();
    const pool = item.token.poolAddress?.toLowerCase();
    const curve = item.token.curveAddress?.toLowerCase();
    const isTokenArc =
      paired === arcWeth ||
      pool === arcFactory ||
      curve === '0x6c1c1a77771bf8961e27ea5b21f575eb17a7626e';

    return isArc ? isTokenArc : !isTokenArc;
  });

  const q = query.value.trim().toLowerCase();
  if (!q) return chainFiltered.slice(0, 8);
  return chainFiltered.filter((item) => {
    return (
      item.token.name.toLowerCase().includes(q) ||
      item.token.symbol.toLowerCase().includes(q) ||
      item.token.address.toLowerCase().includes(q)
    );
  });
});

function selectToken(address: string) {
  emit('selectToken', address);
  emit('close');
}
</script>
