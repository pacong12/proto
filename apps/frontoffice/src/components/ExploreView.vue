<template>
  <div class="max-w-7xl mx-auto space-y-10">
    <!-- 1. What this page is, and the one action it leads to. -->
    <section class="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
      <div class="space-y-2 max-w-3xl">
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          The launch floor for {{ activeNetwork.name }}.
        </h1>
        <p class="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Launch a coin with locked liquidity. Find your community. Every trade shares fees in
          {{ activeNetwork.nativeCurrency.symbol }}.
        </p>
        <p class="text-sm text-muted-foreground tabular-nums">
          <span class="font-semibold text-foreground"
            >${{ totalVolume24hUsd.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}</span
          >
          traded in 24h
          <span class="mx-1.5 text-muted-foreground/50">&middot;</span>
          <span class="font-semibold text-foreground">{{ totalTokensCount }}</span>
          coins
        </p>
      </div>
      <Button
        size="default"
        variant="default"
        class="h-10 px-5 text-sm font-semibold gap-1.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition cursor-pointer self-start shrink-0 sm:mt-1"
        @click="$emit('selectTab', 'create')"
      >
        <Plus class="w-4 h-4 stroke-[2.5]" />
        <span>{{ t('createToken') }}</span>
      </Button>
    </section>

    <!-- 2. The latest launches. Shown while loading too (skeleton), so the list does not jump. -->
    <section v-if="latestLaunches.length > 0 || loading" class="space-y-3">
      <h2 class="text-base font-bold text-foreground tracking-tight">
        New on {{ activeNetwork.name }}
      </h2>
      <div
        v-if="latestLaunches.length === 0"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        aria-hidden="true"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-[70px] rounded-2xl bg-card border border-border animate-pulse"
        />
      </div>
      <ExploreFeaturedMovers
        v-else
        :latest-launches="latestLaunches"
        :is-pinned="isPinned"
        @select-token="$emit('selectToken', $event)"
        @toggle-pin="togglePin"
      />
    </section>

    <!-- 3. Every coin: filter tabs, search and view in one bar, then the list. -->
    <section class="space-y-4">
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border text-sm"
      >
        <Tabs v-model="activeMarketTab" class="w-full min-w-0 md:w-auto md:flex-1">
          <TabsList
            variant="line"
            class="overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-b-0 w-auto"
          >
            <TabsTrigger v-for="tab in marketTabs" :key="tab.value" :value="tab.value">
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
          <!-- The token list below is the visible panel; these keep aria-controls valid. -->
          <TabsContent
            v-for="tab in marketTabs"
            :key="`panel-${tab.value}`"
            :value="tab.value"
            class="sr-only"
          >
            {{ tab.label }}
          </TabsContent>
        </Tabs>

        <div class="flex items-center gap-2 pb-2 md:pb-1.5 shrink-0">
          <div class="relative flex-1 md:w-60 md:flex-none">
            <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              v-model="searchQuery"
              type="text"
              placeholder="Search coins / address..."
              class="h-9 pl-8 pr-3 text-sm bg-card border-border rounded-xl text-foreground focus-visible:ring-foreground"
            />
          </div>
          <div
            class="inline-flex items-center p-0.5 rounded-xl border border-border bg-card shrink-0"
            role="group"
            aria-label="View"
          >
            <button
              v-for="opt in viewOptions"
              :key="opt.mode"
              type="button"
              class="h-8 w-8 inline-flex items-center justify-center rounded-[10px] transition cursor-pointer"
              :class="
                viewMode === opt.mode
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              :title="opt.label"
              :aria-label="opt.label"
              :aria-pressed="viewMode === opt.mode"
              @click="viewMode = opt.mode"
            >
              <component :is="opt.icon" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Error Banner -->
      <div
        v-if="apiError"
        class="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2"
      >
        <AlertCircle class="w-4 h-4 shrink-0" />
        <span>{{ apiError }}</span>
      </div>

      <!-- Loading State -->
      <div
        v-if="loading && allTokens.length === 0"
        class="flex flex-col items-center justify-center py-24 space-y-3"
      >
        <Loader2 class="w-7 h-7 text-emerald-500 animate-spin" />
        <span class="text-xs font-medium text-muted-foreground">
          Loading coins on {{ activeNetwork.name }}...
        </span>
      </div>

      <!-- ============================================================
           4A. SHADCN UI TABLE VIEW
           ============================================================ -->
      <ExploreTable
        v-else-if="viewMode === 'table' && filteredTokens.length > 0"
        :paginated-tokens="paginatedTokens"
        :total-items="filteredTokens.length"
        :current-page="currentPage"
        :page-size="pageSize"
        :currency-symbol="currencySymbol"
        :is-pinned="isPinned"
        @select-token="$emit('selectToken', $event)"
        @toggle-pin="togglePin"
        @update:current-page="currentPage = $event"
      />

      <!-- ============================================================
           4B. CARD GRID VIEW MODE
           ============================================================ -->
      <ExploreGrid
        v-else-if="viewMode === 'grid' && filteredTokens.length > 0"
        :paginated-tokens="paginatedTokens"
        :total-items="filteredTokens.length"
        :current-page="currentPage"
        :page-size="pageSize"
        :is-pinned="isPinned"
        @select-token="$emit('selectToken', $event)"
        @toggle-pin="togglePin"
        @update:current-page="currentPage = $event"
      />

      <!-- Empty State -->
      <Empty
        v-else-if="filteredTokens.length === 0"
        title="No coins found"
        description="Be the first to launch a coin on this market!"
        class="border border-border rounded-2xl p-12 bg-card text-center"
      >
        <template #action>
          <Button
            size="default"
            class="h-9 px-4 text-sm font-semibold gap-1.5 rounded-xl cursor-pointer"
            @click="$emit('selectTab', 'create')"
          >
            <Plus class="w-4 h-4 stroke-[2.5]" />
            {{ t('createToken') }}
          </Button>
        </template>
      </Empty>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAutoRefresh } from '@/composables/useAutoRefresh';
import { Plus, Loader2, AlertCircle, Search, List, LayoutGrid } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { usePinnedTokens } from '@/composables/usePinnedTokens';
import { ExploreFeaturedMovers, ExploreTable, ExploreGrid } from './explore';

const { t } = useI18n();
const { activeNetwork } = useWallet();

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const viewMode = ref<'table' | 'grid'>('table');
const viewOptions = [
  { mode: 'table', label: 'List', icon: List },
  { mode: 'grid', label: 'Grid', icon: LayoutGrid },
] as const;
const activeMarketTab = ref<
  'trending' | 'newest' | 'curve' | 'dividends' | 'top' | 'highvol' | 'gainers' | 'pinned'
>('trending');

// Watchlist Pin Feature — shared singleton composable (FE-02)
const { pinnedTokens, togglePin, isPinned } = usePinnedTokens();

const marketTabs = computed(() => [
  { label: 'Trending', value: 'trending' as const },
  { label: 'New', value: 'newest' as const },
  { label: 'Fair launch', value: 'curve' as const },
  { label: 'Dividends', value: 'dividends' as const },
  { label: 'Top', value: 'top' as const },
  { label: 'High vol', value: 'highvol' as const },
  { label: 'Movers', value: 'gainers' as const },
  { label: `Pinned (${pinnedTokens.value.size})`, value: 'pinned' as const },
]);

const currencySymbol = computed(() => activeNetwork.value.nativeCurrency.symbol);

const searchQuery = ref('');
const tokenStore = useTokenStore();
const allTokens = tokenStore.tokens;
const networkTokens = tokenStore.networkTokens;
const loading = tokenStore.loading;
const apiError = ref<string | null>(null);
const currentPage = ref(1);
const pageSize = 15;

// Top 4 Latest Launches
const latestLaunches = computed(() => {
  return [...networkTokens.value].sort((a, b) => b.token.createdAt - a.token.createdAt).slice(0, 4);
});

const totalTokensCount = computed(() => networkTokens.value.length);
const totalVolume24hUsd = computed(() => {
  return networkTokens.value.reduce((acc, curr) => acc + (curr.marketData?.volume24hUsd || 0), 0);
});

// Main Filtered & Sorted Tokens
const filteredTokens = computed(() => {
  let list = [...networkTokens.value];

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (item) =>
        item.token.name.toLowerCase().includes(q) ||
        item.token.symbol.toLowerCase().includes(q) ||
        item.token.address.toLowerCase().includes(q),
    );
  }

  if (activeMarketTab.value === 'pinned') {
    return list.filter((item) => isPinned(item.token.address));
  } else if (activeMarketTab.value === 'newest') {
    list.sort((a, b) => b.token.createdAt - a.token.createdAt);
  } else if (activeMarketTab.value === 'curve') {
    list = list.filter((item) => !item.marketData?.isGraduated);
  } else if (activeMarketTab.value === 'dividends') {
    list = list.filter((item) => (item.token.taxConfig?.revenueSplit?.holders ?? 0) > 0);
    list.sort((a, b) => (b.marketData?.marketCapUsd ?? 0) - (a.marketData?.marketCapUsd ?? 0));
  } else if (activeMarketTab.value === 'highvol') {
    list.sort((a, b) => (b.marketData?.volume24hUsd ?? 0) - (a.marketData?.volume24hUsd ?? 0));
  } else if (activeMarketTab.value === 'gainers') {
    list.sort((a, b) => (b.marketData?.priceChange24h ?? 0) - (a.marketData?.priceChange24h ?? 0));
  } else {
    // Trending: volume + progress
    list.sort((a, b) => {
      const volA = a.marketData?.volume24hUsd ?? 0;
      const volB = b.marketData?.volume24hUsd ?? 0;
      return (
        volB - volA ||
        (b.marketData?.graduationProgress ?? 0) - (a.marketData?.graduationProgress ?? 0)
      );
    });
  }

  return list;
});

watch([searchQuery, activeMarketTab], () => {
  currentPage.value = 1;
});

const paginatedTokens = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredTokens.value.slice(start, start + pageSize);
});

onMounted(async () => {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    viewMode.value = 'grid';
  }
  try {
    await tokenStore.fetchTokens();
    if (tokenStore.error.value) {
      apiError.value = tokenStore.error.value;
    }
  } catch (e) {
    apiError.value = (e as Error).message;
  }
});

// Live: new launches, market caps and volume move with every trade.
useAutoRefresh(() => tokenStore.fetchTokens(true), 15_000);
</script>
