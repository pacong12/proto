<template>
  <div class="space-y-7 max-w-7xl mx-auto">
    <!-- ============================================================
         1. UBI.FUN-STYLE LATEST LAUNCHES / NEW ON NETWORK
         ============================================================ -->
    <div v-if="latestLaunches.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-foreground">New on {{ activeNetwork.name }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <Button
            @click="$emit('selectTab', 'create')"
            size="sm"
            variant="default"
            class="h-7 text-xs font-bold gap-1 rounded-lg cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5 stroke-[3]" />
            <span>{{ t('create') }}</span>
          </Button>
        </div>
      </div>

      <!-- Horizontal Cards Grid (ubi.fun style) -->
      <ExploreFeaturedMovers
        :latest-launches="latestLaunches"
        :is-pinned="isPinned"
        @select-token="$emit('selectToken', $event)"
        @toggle-pin="togglePin"
      />
    </div>

    <!-- ============================================================
         2. PROTOCOL HIGHLIGHTS HERO STRIP (ubi.fun style)
         ============================================================ -->
    <div
      class="p-5 sm:p-6 rounded-3xl bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xs"
    >
      <div class="space-y-1.5 max-w-xl">
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          The launch floor for {{ activeNetwork.name }}.
        </h1>
        <p class="text-sm text-muted-foreground leading-relaxed mt-1">
          Launch a coin with locked liquidity. Find your community. Every trade shares fees in
          {{ activeNetwork.nativeCurrency.symbol }}.
        </p>
      </div>

      <div class="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-6 text-xs w-full md:w-auto">
        <div
          class="p-3 sm:p-0 rounded-xl bg-black border border-border sm:border-0 sm:bg-transparent"
        >
          <span class="text-muted-foreground text-xs uppercase tracking-wider block font-semibold">
            24h Volume
          </span>
          <span class="font-extrabold text-sm sm:text-base text-foreground">
            ${{ totalVolume24hUsd.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}
          </span>
        </div>
        <div
          class="p-3 sm:p-0 rounded-xl bg-black border border-border sm:border-0 sm:bg-transparent"
        >
          <span class="text-muted-foreground text-xs uppercase tracking-wider block font-semibold">
            Total Coins
          </span>
          <span class="font-extrabold text-sm sm:text-base text-foreground">
            {{ totalTokensCount }}
          </span>
        </div>
      </div>
    </div>

    <!-- ============================================================
         3. EXPLORE COINS / MARKETS FILTER HEADER
         ============================================================ -->
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-lg sm:text-xl font-bold tracking-tight text-foreground">Explore coins</h2>
        </div>

        <!-- Right Controls: View Mode Switcher (Pons-Style Pills) -->
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <div
            class="inline-flex items-center p-1 bg-black rounded-full border border-border gap-1"
          >
            <button
              type="button"
              @click="viewMode = 'table'"
              class="px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer flex items-center gap-1.5"
              :class="
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-xs border border-border/80 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              "
            >
              <List class="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              @click="viewMode = 'grid'"
              class="px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer flex items-center gap-1.5"
              :class="
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs border border-border/80 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              "
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation Filter Pills (Shadcn Tabs variant="line") + Search Bar -->
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-border text-xs"
      >
        <!-- Filter Tabs -->
        <Tabs v-model="activeMarketTab" class="w-full md:w-auto">
          <TabsList
            variant="line"
            class="overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-b-0 w-auto"
          >
            <TabsTrigger v-for="tab in marketTabs" :key="tab.value" :value="tab.value">
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- Search Bar -->
        <div class="relative w-full md:w-64 shrink-0">
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search coins / address..."
            class="h-8 pl-8 pr-3 text-xs bg-card border-border rounded-xl text-foreground focus-visible:ring-foreground"
          />
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="apiError"
      class="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2 font-mono"
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
      <span class="text-xs font-medium text-muted-foreground font-mono">
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
          @click="$emit('selectTab', 'create')"
          size="default"
          class="gap-1.5 font-bold rounded-xl cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          Create a coin
        </Button>
      </template>
    </Empty>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Plus, Loader2, AlertCircle, Search, List, LayoutGrid } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
</script>
