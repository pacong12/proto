<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-foreground">{{ t('memestock') }}</h1>
        <p class="text-sm mt-1 text-muted-foreground">
          {{ t('memestockSubtitle') }}
        </p>
      </div>

      <div
        class="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto"
      >
        <!-- Shadcn Tabs for Filtering -->
        <Tabs v-model="selectedSort" class="overflow-x-auto no-scrollbar flex-1 sm:flex-initial">
          <TabsList class="overflow-x-auto no-scrollbar shrink-0">
            <TabsTrigger value="Trending" class="cursor-pointer">
              {{ t('trending') }}
            </TabsTrigger>
            <TabsTrigger value="Top Gainers" class="cursor-pointer">
              {{ t('topGainers') }}
            </TabsTrigger>
            <TabsTrigger value="Highest Volume" class="cursor-pointer">
              {{ t('highestVolume') }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- Search Input -->
        <div class="relative w-full sm:w-44">
          <Search
            class="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
          />
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Filter memes..."
            class="h-8 pl-8 pr-2.5 text-xs font-mono"
          />
        </div>

        <!-- Refresh Button -->
        <Button
          variant="outline"
          size="sm"
          class="h-8 w-8 p-0 border-border hover:bg-muted text-foreground cursor-pointer shrink-0"
          title="Refresh memestock feed"
          aria-label="Refresh memestock feed"
          @click="fetchTokens"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </Button>

        <!-- Launch Button -->
        <Button
          @click="$emit('selectTab', 'create')"
          variant="default"
          size="sm"
          class="h-8 sm:h-9 px-3 sm:px-4 gap-1.5 font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus class="w-4 h-4" />
          {{ t('create') }}
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 class="w-7 h-7 text-foreground animate-spin" />
      <span class="text-xs text-muted-foreground font-mono">{{ t('loadingTape') }}</span>
    </div>

    <!-- Error Banner -->
    <div
      v-else-if="apiError"
      class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center justify-between gap-3"
    >
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
        <span>{{ apiError }}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 text-xs font-semibold cursor-pointer shrink-0"
        @click="fetchTokens"
      >
        Retry
      </Button>
    </div>

    <!-- Empty State using Shadcn Empty -->
    <Empty
      v-else-if="filteredAndSortedItems.length === 0"
      :title="searchQuery ? 'No matching memestocks' : t('noMemesTitle')"
      :description="
        searchQuery ? `No tokens match '${searchQuery}'. Try another query.` : t('noMemesDesc')
      "
    >
      <template #action>
        <Button
          v-if="!searchQuery"
          @click="$emit('selectTab', 'create')"
          variant="default"
          size="default"
          class="font-bold gap-2 shadow-md cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          {{ t('launchNow') }}
        </Button>
        <Button v-else @click="searchQuery = ''" variant="outline" size="sm" class="cursor-pointer">
          Clear search
        </Button>
      </template>
    </Empty>

    <!-- Meme Feed Cards with 100% Shadcn Card & Badge -->
    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        <Card
          v-for="item in paginatedItems"
          :key="item.token.address"
          @click="$emit('selectToken', item.token.address)"
          class="group hover:border-primary/50 cursor-pointer transition-all flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4"
        >
          <div class="space-y-3.5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="48"
                  :height="48"
                  class="rounded-xl border border-border group-hover:border-foreground/40 transition shrink-0"
                />
                <div class="min-w-0 truncate">
                  <h3
                    class="font-bold text-base text-foreground group-hover:opacity-85 transition truncate"
                  >
                    {{ item.token.name }}
                  </h3>
                  <p class="text-xs font-mono text-muted-foreground">${{ item.token.symbol }}</p>
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <span
                  v-if="(item.marketData.priceChange24h ?? 0) !== 0"
                  class="text-xs font-mono font-bold"
                  :class="
                    (item.marketData.priceChange24h ?? 0) >= 0
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  "
                >
                  {{ (item.marketData.priceChange24h ?? 0) >= 0 ? '+' : ''
                  }}{{ (item.marketData.priceChange24h ?? 0).toFixed(1) }}%
                </span>
              </div>
            </div>

            <p class="text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {{
                item.token.description ||
                `Community-backed fixed-supply memestock on ${activeNetwork.name}.`
              }}
            </p>

            <div class="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
              <span>Pool Fee: 1%</span>
              <span>•</span>
              <span class="text-foreground font-semibold">70% Creator Fees</span>
            </div>
          </div>

          <div class="mt-5 pt-4 border-t border-border space-y-2">
            <div class="flex justify-between text-xs font-mono">
              <span class="text-muted-foreground">Market Cap</span>
              <span class="font-semibold text-foreground">{{
                formatCompactUsd(item.marketData.marketCapUsd)
              }}</span>
            </div>
            <div class="flex justify-between text-xs font-mono">
              <span class="text-muted-foreground">Graduation ({{ graduationTargetDisplay }})</span>
              <span class="text-foreground font-semibold">
                {{ (item.marketData.graduationProgress * 100).toFixed(1) }}%
              </span>
            </div>

            <!-- Shadcn Progress -->
            <Progress :model-value="item.marketData.graduationProgress * 100" class="h-1.5" />
          </div>
        </Card>
      </div>

      <!-- Shadcn Pagination -->
      <Pagination
        v-if="filteredAndSortedItems.length > pageSize"
        :total="filteredAndSortedItems.length"
        :items-per-page="pageSize"
        :page="currentPage"
        @update:page="currentPage = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Plus, Loader2, AlertCircle, RefreshCw, Search } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty } from '@/components/ui/empty';
import { Pagination } from '@/components/ui/pagination';
import { ARC_CHAIN, type LaunchedTokenEntity, type TokenMarketData } from '@proto/shared-types';
import { formatCompactUsd } from '@/lib/utils';
import { useWallet } from '@/composables/useWallet';

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const { t } = useI18n();
const { activeNetwork } = useWallet();

const selectedSort = ref('Trending');
const searchQuery = ref('');
const loading = ref(true);
const apiError = ref<string | null>(null);
const items = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);

const currentPage = ref(1);
const pageSize = 9;

watch([selectedSort, searchQuery], () => {
  currentPage.value = 1;
});

const graduationTargetDisplay = computed(() => {
  const thresholdWei = activeNetwork.value.launchConfig.graduationThresholdWei;
  const val = Number(thresholdWei) / 10 ** 18;
  const symbol = activeNetwork.value.nativeCurrency.symbol;
  if (val >= 1000) {
    return `${(val / 1000).toFixed(0)}K ${symbol}`;
  }
  return `${val.toFixed(1)} ${symbol}`;
});

// Filter items by active network (Robinhood Chain 4663 vs Arc Network 5042)
const networkTokens = computed(() => {
  const isArc = activeNetwork.value.chainId === ARC_CHAIN.chainId;
  const arcWeth = ARC_CHAIN.contracts.weth.toLowerCase();
  const arcFactory = ARC_CHAIN.contracts.factory.toLowerCase();
  const arcFactoryV2 = (ARC_CHAIN.contracts.factoryV2 ?? ARC_CHAIN.contracts.factory).toLowerCase();

  return items.value.filter((item) => {
    const paired = item.token.pairedToken?.toLowerCase();
    const pool = item.token.poolAddress?.toLowerCase();
    const isTokenArc = paired === arcWeth || pool === arcFactory || pool === arcFactoryV2;
    return isArc ? isTokenArc : !isTokenArc;
  });
});

const filteredAndSortedItems = computed(() => {
  let list = networkTokens.value;

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (item) =>
        item.token.name.toLowerCase().includes(q) ||
        item.token.symbol.toLowerCase().includes(q) ||
        item.token.address.toLowerCase().includes(q),
    );
  }

  if (selectedSort.value === 'Top Gainers') {
    return [...list].sort(
      (a, b) => (b.marketData.priceChange24h ?? 0) - (a.marketData.priceChange24h ?? 0),
    );
  }
  if (selectedSort.value === 'Highest Volume') {
    return [...list].sort(
      (a, b) => (b.marketData.volume24hUsd || 0) - (a.marketData.volume24hUsd || 0),
    );
  }
  // Default 'Trending'
  return [...list].sort(
    (a, b) =>
      (b.marketData.volume24hUsd || 0) +
      b.marketData.graduationProgress * 1000 -
      ((a.marketData.volume24hUsd || 0) + a.marketData.graduationProgress * 1000),
  );
});

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredAndSortedItems.value.slice(start, start + pageSize);
});

async function fetchTokens() {
  loading.value = true;
  apiError.value = null;
  try {
    const res = await fetch('/api/tokens');
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      items.value = envelope.data;
    } else {
      apiError.value = envelope.error?.message || 'Unable to fetch memestock feed';
    }
  } catch (err) {
    apiError.value = (err as Error).message || 'Network error fetching memestocks';
  } finally {
    loading.value = false;
  }
}

watch(
  () => activeNetwork.value.chainId,
  () => {
    currentPage.value = 1;
    fetchTokens();
  },
);

onMounted(() => {
  fetchTokens();
});
</script>
