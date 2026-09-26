<template>
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-20 bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4"
    @click.self="$emit('close')"
  >
    <Card
      class="w-[calc(100vw-2rem)] sm:w-full max-w-2xl sm:max-w-3xl shadow-2xl overflow-hidden p-0 border border-border bg-card rounded-2xl flex flex-col transition-all duration-200"
    >
      <!-- Search Input Header -->
      <div class="flex items-center gap-3 px-5 py-3.5 border-b border-border">
        <Search class="w-5 h-5 text-foreground shrink-0" />
        <Input
          ref="searchInput"
          v-model="query"
          type="text"
          :placeholder="
            t('searchPlaceholder') ||
            'Search tokens by name, ticker, contract address, or 0x tx hash...'
          "
          class="border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 bg-transparent h-10 text-sm sm:text-base px-0 text-foreground placeholder:text-muted-foreground"
          @keydown.esc="$emit('close')"
          @keydown="handleKeydown"
        />
        <button
          type="button"
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer flex items-center justify-center shrink-0"
          @click="$emit('close')"
          aria-label="Close search"
        >
          <span
            class="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/60"
          >
            ESC
          </span>
          <X class="w-4 h-4 sm:hidden" />
        </button>
      </div>

      <!-- Search Results List -->
      <div class="max-h-[30rem] overflow-y-auto p-3">
        <div
          v-if="loading || searchingTx"
          class="flex items-center justify-center py-10 text-xs gap-2 text-muted-foreground"
        >
          <Loader2 class="w-4 h-4 animate-spin text-foreground" />
          <span>{{ searchingTx ? 'Searching transaction...' : t('searchingTokens') }}</span>
        </div>

        <!-- Matched Transaction Result Card -->
        <div
          v-if="matchedTrade && !searchingTx"
          class="mb-2 p-3 rounded-xl border border-border bg-muted/40 text-xs space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono uppercase font-bold text-muted-foreground">
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
                class="font-mono text-xs font-bold text-foreground group-hover:text-foreground/80 transition truncate block"
              >
                {{ shortenAddress(matchedTrade.transactionHash, 10, 8) }}
              </span>
              <p class="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
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
                class="p-1.5 rounded-lg border border-border hover:text-foreground text-muted-foreground transition"
                title="View on Explorer"
                @click.stop
              >
                <ExternalLink class="w-3.5 h-3.5" />
              </a>
              <span class="text-xs font-semibold text-foreground group-hover:underline">
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
                  ? 'bg-muted border-border ring-1 ring-border'
                  : 'bg-card border-transparent hover:bg-muted',
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
                  class="rounded-xl border border-border shrink-0"
                />

                <div class="truncate">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-bold text-foreground group-hover:text-foreground/80 transition truncate"
                    >
                      {{ item.token.name }}
                    </span>
                    <span class="text-xs font-mono text-muted-foreground">
                      ${{ item.token.symbol }}
                    </span>
                    <Badge
                      :variant="item.token.version === 'v2' ? 'outline' : 'secondary'"
                      class="text-[9px] px-1 py-0 h-3.5 font-mono uppercase"
                    >
                      {{ item.token.version === 'v2' ? 'v2' : 'v1' }}
                    </Badge>
                  </div>
                  <p class="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                    {{ item.token.address }}
                  </p>
                </div>
              </div>

              <div class="text-right shrink-0 font-mono text-xs ml-2 sm:ml-4 space-y-0.5">
                <span class="font-bold block text-foreground">
                  {{ formatPriceUsd(item.marketData?.priceUsd) }}
                </span>
                <div class="flex items-center justify-end gap-1.5 text-[11px]">
                  <span class="text-muted-foreground hidden sm:inline">
                    MCap: {{ formatCompactUsd(item.marketData?.marketCapUsd) }} •
                  </span>
                  <span
                    :class="
                      item.marketData?.isGraduated
                        ? 'text-foreground font-bold'
                        : 'text-muted-foreground'
                    "
                  >
                    {{
                      item.marketData?.isGraduated
                        ? t('graduated')
                        : `${((item.marketData?.graduationProgress ?? 0) * 100).toFixed(0)}%`
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
        class="px-4 py-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground"
      >
        <span>
          {{ t('navigateHint') }}:
          <kbd class="bg-muted text-foreground border border-border px-1 py-0.5 rounded text-[10px]"
            >↑</kbd
          >
          <kbd
            class="bg-muted text-foreground border border-border px-1 py-0.5 rounded text-[10px] ml-0.5"
            >↓</kbd
          >
        </span>
        <span>
          {{ t('selectHint') }}:
          <kbd
            class="bg-muted text-foreground border border-border px-1.5 py-0.5 rounded text-[10px]"
            >ENTER</kbd
          >
        </span>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Search, Loader2, ExternalLink, X } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { shortenAddress, formatCompactUsd, formatPriceUsd } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Empty } from '@/components/ui/empty';
import type { LaunchedTokenEntity, TokenMarketData, TradeEventEntity } from '@proto/shared-types';
import { ARC_CHAIN, ARC_PROTO_CURVE_ADDRESS } from '@proto/shared-types';

const { t } = useI18n();
const { activeNetwork } = useWallet();
const tokenStore = useTokenStore();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectToken', address: string): void;
}>();

const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const loading = tokenStore.loading;
const searchingTx = ref(false);
const matchedTrade = ref<TradeEventEntity | null>(null);
const tokens = tokenStore.tokens;
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
  // Share the already-fetched token list from the store; no extra network request
  // if ExploreView already populated it within the last 15 seconds.
  await tokenStore.fetchTokens();
});

const filteredTokens = computed(() => {
  const isArc = activeNetwork.value.chainId === ARC_CHAIN.chainId;
  const arcWeth = ARC_CHAIN.contracts.weth.toLowerCase();
  const arcFactory = ARC_CHAIN.contracts.factory.toLowerCase();

  const chainFiltered = tokens.value.filter((item) => {
    const paired = item.token.pairedToken?.toLowerCase();
    const pool = item.token.poolAddress?.toLowerCase();
    const curve = item.token.curveAddress?.toLowerCase();
    const isTokenArc =
      paired === arcWeth || pool === arcFactory || curve === ARC_PROTO_CURVE_ADDRESS.toLowerCase();

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
