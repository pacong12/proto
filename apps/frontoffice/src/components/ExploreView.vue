<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- 1. OKX-Style Quick Market Highlights Ticker Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <!-- Hot / Trending -->
      <div
        class="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-zinc-950/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition"
        @click="selectTabFilter('trending')"
      >
        <div class="space-y-0.5">
          <span class="text-[11px] font-mono text-zinc-400">
            {{ t('trendingTokens') }}
          </span>
          <p class="text-sm font-bold font-mono text-black dark:text-white">
            {{ topTrendingSymbol }}
          </p>
        </div>
        <span class="text-xs font-mono font-bold text-emerald-500">{{ topTrendingChange }}</span>
      </div>

      <!-- New Launches -->
      <div
        class="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-zinc-950/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition"
        @click="selectTabFilter('newest')"
      >
        <div class="space-y-0.5">
          <span class="text-[11px] font-mono text-zinc-400">
            {{ t('newLaunches') }}
          </span>
          <p class="text-sm font-bold font-mono text-black dark:text-white">
            {{ totalTokensCount }} Tokens
          </p>
        </div>
        <span class="text-xs font-mono text-zinc-400">Robinhood L2</span>
      </div>

      <!-- Top Gainers -->
      <div
        class="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-zinc-950/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition"
        @click="selectTabFilter('gainers')"
      >
        <div class="space-y-0.5">
          <span class="text-[11px] font-mono text-zinc-400">
            {{ t('topGainers') }}
          </span>
          <p class="text-sm font-bold font-mono text-black dark:text-white">
            {{ topGainerSymbol }}
          </p>
        </div>
        <span class="text-xs font-mono font-bold text-emerald-500">{{ topGainerChange }}</span>
      </div>

      <!-- 24h Aggregated Volume -->
      <div
        class="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-zinc-950/80 shadow-xs flex items-center justify-between"
      >
        <div class="space-y-0.5">
          <span class="text-[11px] font-mono text-zinc-400">
            {{ t('volume24hCol') }}
          </span>
          <p class="text-sm font-bold font-mono text-black dark:text-white">
            ${{ totalVolume24hUsd.toLocaleString() }}
          </p>
        </div>
        <span class="text-[10px] font-mono text-zinc-400">Uniswap V3/v4</span>
      </div>
    </div>

    <!-- 2. OKX-Style Primary Market Navigation & Actions Header -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800"
    >
      <!-- Market Tabs Navigation -->
      <div class="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          v-for="tab in marketTabs"
          :key="tab.value"
          @click="activeMarketTab = tab.value"
          :class="[
            'px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer',
            activeMarketTab === tab.value
              ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
              : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Right Action: Launch Token Primary Button -->
      <div class="flex items-center gap-3 shrink-0">
        <Button
          @click="$emit('selectTab', 'create')"
          variant="default"
          size="sm"
          class="h-9 px-4 gap-1.5 font-bold bg-emerald-500 hover:bg-emerald-600 text-black shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          {{ t('create') }}
        </Button>
      </div>
    </div>

    <!-- 3. OKX-Style Filter & Search Control Bar -->
    <div
      class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2 bg-zinc-50/90 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80"
    >
      <!-- Left Controls: Search Bar + Lifecycle Filter Buttons -->
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        <!-- Live Search Input -->
        <div class="relative w-full sm:w-64">
          <Search class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
          <Input
            v-model="searchQuery"
            type="text"
            :placeholder="t('searchTokenPlaceholder')"
            class="h-8 pl-8 pr-3 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-black dark:text-white focus-visible:ring-emerald-500"
          />
        </div>

        <!-- Lifecycle Status Filter: All / Curve / Graduated -->
        <div
          class="inline-flex items-center p-0.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium"
        >
          <button
            type="button"
            @click="selectedLifecycle = 'all'"
            :class="[
              'px-2.5 py-1 rounded text-xs transition cursor-pointer',
              selectedLifecycle === 'all'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold shadow-xs'
                : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white',
            ]"
          >
            {{ t('all') }}
          </button>
          <button
            type="button"
            @click="selectedLifecycle = 'curve'"
            :class="[
              'px-2.5 py-1 rounded text-xs transition cursor-pointer',
              selectedLifecycle === 'curve'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-emerald-500 font-bold shadow-xs'
                : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white',
            ]"
          >
            {{ t('onCurve') }}
          </button>
          <button
            type="button"
            @click="selectedLifecycle = 'graduated'"
            :class="[
              'px-2.5 py-1 rounded text-xs transition cursor-pointer',
              selectedLifecycle === 'graduated'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-indigo-400 font-bold shadow-xs'
                : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white',
            ]"
          >
            {{ t('graduated') }}
          </button>
        </div>

        <!-- Socials Only Filter Toggle -->
        <Button
          type="button"
          size="sm"
          :variant="filterHasSocials ? 'default' : 'outline'"
          class="h-8 px-2.5 gap-1.5 text-xs font-medium rounded-lg border-zinc-200 dark:border-zinc-800 cursor-pointer"
          @click="filterHasSocials = !filterHasSocials"
        >
          <Share2 class="w-3 h-3" />
          <span>{{ t('hasSocials') }}</span>
        </Button>
      </div>

      <!-- Right Controls: View Mode Toggle (Table / Grid) + Sort Combobox -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- View Mode Toggle: Table vs Grid -->
        <div
          class="inline-flex items-center p-0.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          <button
            type="button"
            @click="viewMode = 'table'"
            :title="t('tableMode')"
            :class="[
              'p-1.5 rounded transition cursor-pointer',
              viewMode === 'table'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-emerald-500 shadow-xs'
                : 'text-zinc-400 hover:text-black dark:hover:text-white',
            ]"
          >
            <List class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="viewMode = 'grid'"
            :title="t('gridMode')"
            :class="[
              'p-1.5 rounded transition cursor-pointer',
              viewMode === 'grid'
                ? 'bg-zinc-100 dark:bg-zinc-800 text-emerald-500 shadow-xs'
                : 'text-zinc-400 hover:text-black dark:hover:text-white',
            ]"
          >
            <LayoutGrid class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Sorting Combobox -->
        <Combobox
          v-model="activeSort"
          :options="sortOptions"
          class="w-36 sm:w-44"
          :placeholder="t('sortTokens')"
        />
      </div>
    </div>

    <!-- 4. Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 space-y-3">
      <Loader2 class="w-7 h-7 text-emerald-500 animate-spin" />
      <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-mono">{{
        t('loadingTokens')
      }}</span>
    </div>

    <!-- 5. API Error State -->
    <div
      v-else-if="apiError"
      class="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-600 dark:text-amber-400"
    >
      <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
      <span>{{ apiError }}</span>
    </div>

    <!-- 6. Empty State -->
    <Empty
      v-else-if="filteredTokens.length === 0"
      :title="t('noTokensFound')"
      :description="t('noTokensDesc')"
      class="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 bg-white dark:bg-zinc-950"
    >
      <template #action>
        <Button
          @click="$emit('selectTab', 'create')"
          size="default"
          class="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-md rounded-xl cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          {{ t('createToken') }}
        </Button>
      </template>
    </Empty>

    <!-- 7A. OKX-Style Professional Table View Mode -->
    <div
      v-else-if="viewMode === 'table'"
      class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs font-mono">
          <thead>
            <tr
              class="border-b border-zinc-200 dark:border-zinc-800/90 text-zinc-400 uppercase tracking-wider text-[11px] bg-zinc-50/70 dark:bg-zinc-900/40"
            >
              <th class="py-3 px-4 font-semibold">{{ t('tokenCol') }}</th>
              <th class="py-3 px-4 font-semibold text-right">{{ t('lastPriceCol') }}</th>
              <th class="py-3 px-4 font-semibold text-right">{{ t('change24hCol') }}</th>
              <th class="py-3 px-4 font-semibold text-right">{{ t('volume24hCol') }}</th>
              <th class="py-3 px-4 font-semibold text-right">{{ t('marketCapCol') }}</th>
              <th class="py-3 px-4 font-semibold text-center w-48">{{ t('progressCol') }}</th>
              <th class="py-3 px-4 font-semibold text-right">{{ t('actionCol') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-zinc-900">
            <tr
              v-for="item in paginatedTokens"
              :key="item.token.address"
              class="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer group"
              @click="$emit('selectToken', item.token.address)"
            >
              <!-- Token Name, Symbol, & Version Badge -->
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <Avatar
                    class="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 shrink-0"
                  >
                    <img
                      v-if="item.token.logo && item.token.logo.startsWith('http')"
                      :src="item.token.logo"
                      :alt="item.token.name"
                      class="w-full h-full object-cover"
                    />
                    <AvatarFallback
                      class="bg-zinc-100 dark:bg-zinc-800 text-emerald-500 font-bold text-xs rounded-lg"
                    >
                      {{ item.token.symbol.slice(0, 3) }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="truncate">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="font-bold text-black dark:text-white group-hover:text-emerald-500 transition"
                      >
                        {{ item.token.name }}
                      </span>
                      <Badge
                        :variant="item.token.version === 'v2' ? 'outline' : 'secondary'"
                        class="text-[9px] px-1 py-0 h-3.5 uppercase font-mono"
                      >
                        {{ item.token.version === 'v2' ? 'v2' : 'v1' }}
                      </Badge>
                    </div>
                    <span class="text-[11px] text-zinc-400 font-mono"
                      >${{ item.token.symbol }}</span
                    >
                  </div>
                </div>
              </td>

              <!-- Last Price -->
              <td class="py-3 px-4 text-right font-bold text-black dark:text-white">
                ${{ item.marketData.priceUsd.toFixed(8) }}
              </td>

              <!-- 24h Change -->
              <td class="py-3 px-4 text-right font-bold text-emerald-500 dark:text-emerald-400">
                {{ (item.marketData.priceChange24h ?? 0) >= 0 ? '+' : ''
                }}{{ (item.marketData.priceChange24h ?? 0).toFixed(2) }}%
              </td>

              <!-- 24h Volume -->
              <td class="py-3 px-4 text-right text-zinc-600 dark:text-zinc-300">
                ${{ (item.marketData.volume24hUsd || 0).toLocaleString() }}
              </td>

              <!-- Market Cap -->
              <td class="py-3 px-4 text-right text-zinc-600 dark:text-zinc-300 font-semibold">
                ${{ item.marketData.marketCapUsd.toLocaleString() }}
              </td>

              <!-- Graduation / Bonding Progress -->
              <td class="py-3 px-4">
                <div class="space-y-1 max-w-[160px] mx-auto">
                  <div class="flex justify-between text-[10px]">
                    <span class="text-zinc-400">
                      {{ item.marketData.isGraduated ? 'DEX Pool' : 'Curve' }}
                    </span>
                    <span class="font-bold text-emerald-500 dark:text-emerald-400">
                      {{ (item.marketData.graduationProgress * 100).toFixed(1) }}%
                    </span>
                  </div>
                  <Progress
                    :model-value="item.marketData.graduationProgress * 100"
                    class="h-1.5 rounded-full"
                  />
                </div>
              </td>

              <!-- Action Trade Button -->
              <td class="py-3 px-4 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 px-3 text-xs font-semibold rounded-lg border-zinc-200 dark:border-zinc-800 group-hover:border-emerald-500 group-hover:text-emerald-500 transition cursor-pointer"
                  @click.stop="$emit('selectToken', item.token.address)"
                >
                  {{ t('tradeNow') }}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination in Table Footer -->
      <div
        v-if="filteredTokens.length > pageSize"
        class="flex justify-center p-3 border-t border-zinc-200 dark:border-zinc-800"
      >
        <Pagination
          :current-page="currentPage"
          :total-items="filteredTokens.length"
          :page-size="pageSize"
          @update:current-page="currentPage = $event"
        />
      </div>
    </div>

    <!-- 7B. OKX-Style Card Grid View Mode -->
    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          v-for="item in paginatedTokens"
          :key="item.token.address"
          class="group hover:border-emerald-500/50 transition-all p-4 cursor-pointer rounded-xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 flex flex-col justify-between"
          @click="$emit('selectToken', item.token.address)"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <Avatar
                  class="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 shrink-0"
                >
                  <img
                    v-if="item.token.logo && item.token.logo.startsWith('http')"
                    :src="item.token.logo"
                    :alt="item.token.name"
                    class="w-full h-full object-cover"
                  />
                  <AvatarFallback
                    class="bg-zinc-100 dark:bg-zinc-800 text-emerald-500 font-bold text-xs rounded-lg"
                  >
                    {{ item.token.symbol.slice(0, 3) }}
                  </AvatarFallback>
                </Avatar>
                <div class="truncate">
                  <h3
                    class="font-bold text-sm text-black dark:text-white group-hover:text-emerald-500 transition truncate"
                  >
                    {{ item.token.name }}
                  </h3>
                  <div class="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <span>${{ item.token.symbol }}</span>
                    <Badge variant="outline" class="text-[9px] px-1 py-0 h-3.5 uppercase">
                      {{ item.token.version === 'v2' ? 'v2' : 'v1' }}
                    </Badge>
                  </div>
                </div>
              </div>

              <span class="text-xs font-mono font-bold text-emerald-500">
                {{ (item.marketData.priceChange24h ?? 0) >= 0 ? '+' : ''
                }}{{ (item.marketData.priceChange24h ?? 0).toFixed(2) }}%
              </span>
            </div>

            <!-- Price & Cap -->
            <div
              class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900 font-mono text-xs"
            >
              <div>
                <span class="text-[10px] text-zinc-400 block">{{ t('lastPriceCol') }}</span>
                <span class="font-bold text-black dark:text-white"
                  >${{ item.marketData.priceUsd.toFixed(8) }}</span
                >
              </div>
              <div class="text-right">
                <span class="text-[10px] text-zinc-400 block">{{ t('marketCapCol') }}</span>
                <span class="font-semibold text-zinc-600 dark:text-zinc-300"
                  >${{ item.marketData.marketCapUsd.toLocaleString() }}</span
                >
              </div>
            </div>

            <!-- Progress -->
            <div class="space-y-1">
              <div class="flex justify-between text-[10px] font-mono">
                <span class="text-zinc-400">{{
                  item.marketData.isGraduated ? 'Graduated' : 'Curve'
                }}</span>
                <span class="font-bold text-emerald-500"
                  >{{ (item.marketData.graduationProgress * 100).toFixed(1) }}%</span
                >
              </div>
              <Progress
                :model-value="item.marketData.graduationProgress * 100"
                class="h-1.5 rounded-full"
              />
            </div>
          </div>
        </Card>
      </div>

      <!-- Pagination in Grid View -->
      <div v-if="filteredTokens.length > pageSize" class="flex justify-center pt-4">
        <Pagination
          :current-page="currentPage"
          :total-items="filteredTokens.length"
          :page-size="pageSize"
          @update:current-page="currentPage = $event"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Plus,
  Loader2,
  AlertCircle,
  TrendingUp,
  Share2,
  Search,
  List,
  LayoutGrid,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Combobox } from '@/components/ui/combobox';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';
import { useI18n } from '@/lib/i18n';

const { t } = useI18n();

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

// View Mode: Professional OKX Table vs Card Grid
const viewMode = ref<'table' | 'grid'>('table');

// Active Market Category Tab (OKX-Style: All Markets / Trending / New Launches / Top Gainers)
const activeMarketTab = ref<'all' | 'trending' | 'newest' | 'gainers' | 'graduated'>('all');

const marketTabs = computed(() => [
  { label: t('allMarkets'), value: 'all' as const },
  { label: t('trendingTokens'), value: 'trending' as const },
  { label: t('newLaunches'), value: 'newest' as const },
  { label: t('topGainers'), value: 'gainers' as const },
  { label: t('graduatedDEX'), value: 'graduated' as const },
]);

function selectTabFilter(tab: 'trending' | 'newest' | 'gainers') {
  activeMarketTab.value = tab;
}

// Filter States
const searchQuery = ref('');
const selectedLifecycle = ref<'all' | 'curve' | 'graduated'>('all');
const filterHasSocials = ref(false);
const activeSort = ref('recent');

const loading = ref(true);
const apiError = ref<string | null>(null);
const allTokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);
const currentPage = ref(1);
const pageSize = 10; // 10 rows per page like standard exchange tables

// Sorting options
const sortOptions = computed(() => [
  { label: t('recentBuys'), value: 'recent' },
  { label: t('newest'), value: 'newest' },
  { label: t('marketCap'), value: 'mcap' },
  { label: t('volume24h'), value: 'volume' },
  { label: t('graduation'), value: 'graduation' },
]);

const totalTokensCount = computed(() => allTokens.value.length);
const topTrendingSymbol = computed(() => {
  if (allTokens.value.length === 0) return '—';
  return allTokens.value[0]?.token.symbol || '—';
});
const topTrendingChange = computed(() => {
  if (allTokens.value.length === 0) return '0.00%';
  const chg = allTokens.value[0]?.marketData?.priceChange24h ?? 0;
  return `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
});
const topGainerSymbol = computed(() => {
  if (allTokens.value.length === 0) return '—';
  const sorted = [...allTokens.value].sort(
    (a, b) => (b.marketData.priceChange24h ?? 0) - (a.marketData.priceChange24h ?? 0),
  );
  return sorted[0]?.token.symbol || '—';
});
const topGainerChange = computed(() => {
  if (allTokens.value.length === 0) return '0.00%';
  const sorted = [...allTokens.value].sort(
    (a, b) => (b.marketData.priceChange24h ?? 0) - (a.marketData.priceChange24h ?? 0),
  );
  const chg = sorted[0]?.marketData?.priceChange24h ?? 0;
  return `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
});
const totalVolume24hUsd = computed(() => {
  return allTokens.value.reduce((acc, curr) => acc + (curr.marketData.volume24hUsd || 0), 0);
});
// Master Filter Pipeline
const filteredTokens = computed(() => {
  let list = allTokens.value;

  // 1. Filter Search Query
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (item) =>
        item.token.name.toLowerCase().includes(q) ||
        item.token.symbol.toLowerCase().includes(q) ||
        item.token.address.toLowerCase().includes(q),
    );
  }

  // 2. Filter Primary Market Category Tab (OKX Tabs)
  if (activeMarketTab.value === 'trending') {
    list = list.filter(
      (item) =>
        (item.marketData.volume24hUsd || 0) > 5000 || item.marketData.graduationProgress > 0.5,
    );
  } else if (activeMarketTab.value === 'newest') {
    const sortedNew = [...list].sort((a, b) => b.token.createdAt - a.token.createdAt);
    list = sortedNew;
  } else if (activeMarketTab.value === 'gainers') {
    list = [...list].sort(
      (a, b) => b.marketData.graduationProgress - a.marketData.graduationProgress,
    );
  } else if (activeMarketTab.value === 'graduated') {
    list = list.filter((item) => item.marketData.isGraduated);
  }

  // 3. Filter Lifecycle Status Toggle
  if (selectedLifecycle.value === 'curve') {
    list = list.filter((item) => !item.marketData.isGraduated);
  } else if (selectedLifecycle.value === 'graduated') {
    list = list.filter((item) => item.marketData.isGraduated);
  }

  // 4. Filter Socials Only
  if (filterHasSocials.value) {
    list = list.filter((item) => {
      const soc = item.token.socials;
      return !!(soc && (soc.twitter || soc.telegram || soc.website));
    });
  }

  // 5. Active Sort Dropdown
  const sorted = [...list];
  if (activeSort.value === 'newest') {
    sorted.sort((a, b) => b.token.createdAt - a.token.createdAt);
  } else if (activeSort.value === 'mcap') {
    sorted.sort((a, b) => b.marketData.marketCapUsd - a.marketData.marketCapUsd);
  } else if (activeSort.value === 'volume') {
    sorted.sort((a, b) => (b.marketData.volume24hUsd || 0) - (a.marketData.volume24hUsd || 0));
  } else if (activeSort.value === 'graduation') {
    sorted.sort((a, b) => b.marketData.graduationProgress - a.marketData.graduationProgress);
  } else {
    sorted.sort((a, b) => Number(b.token.launchBlock) - Number(a.token.launchBlock));
  }

  return sorted;
});

const paginatedTokens = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredTokens.value.slice(start, start + pageSize);
});

onMounted(async () => {
  try {
    const res = await fetch('/api/tokens');
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      allTokens.value = envelope.data;
    } else {
      apiError.value = envelope.error?.message || 'Unable to fetch tokens';
    }
  } catch (e) {
    apiError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>
