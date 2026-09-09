<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <Sparkles class="w-5 h-5 text-emerald-400" />
          <h1 class="text-3xl font-bold tracking-tight text-black dark:text-white">
            {{ t('exploreLaunches') }}
          </h1>
        </div>
        <p class="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          {{ t('exploreSubtitle') }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Lifecycle Status Filter: All / On Curve / Near Completion / Graduated -->
        <div class="p-1 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center text-xs">
          <button
            type="button"
            @click="selectedLifecycle = 'all'"
            :class="[
              'px-2.5 py-1 rounded font-medium transition',
              selectedLifecycle === 'all'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white',
            ]"
          >
            {{ t('all') }}
          </button>
          <button
            type="button"
            @click="selectedLifecycle = 'curve'"
            :class="[
              'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
              selectedLifecycle === 'curve'
                ? 'bg-zinc-800 text-emerald-400'
                : 'text-zinc-400 hover:text-white',
            ]"
          >
            <Flame class="w-3 h-3" />
            {{ t('onCurve') }}
          </button>
          <button
            type="button"
            @click="selectedLifecycle = 'near_completion'"
            :class="[
              'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
              selectedLifecycle === 'near_completion'
                ? 'bg-zinc-800 text-amber-400'
                : 'text-zinc-400 hover:text-white',
            ]"
            title="Bonding curve progress >= 80%"
          >
            <TrendingUp class="w-3 h-3" />
            &gt;80% Grad
          </button>
          <button
            type="button"
            @click="selectedLifecycle = 'graduated'"
            :class="[
              'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
              selectedLifecycle === 'graduated'
                ? 'bg-zinc-800 text-indigo-400'
                : 'text-zinc-400 hover:text-white',
            ]"
          >
            <CheckCircle class="w-3 h-3" />
            {{ t('graduated') }}
          </button>
        </div>

        <!-- Socials Only Filter Toggle -->
        <button
          type="button"
          @click="filterHasSocials = !filterHasSocials"
          :class="[
            'px-2.5 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5',
            filterHasSocials
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white',
          ]"
        >
          <Share2 class="w-3.5 h-3.5" />
          <span>Has Socials</span>
        </button>

        <!-- Architecture Version Tabs: All / v2 Curve / v1 Pool -->
        <div class="p-1 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center text-xs">
          <button
            type="button"
            @click="selectedVersion = 'all'"
            :class="[
              'px-2.5 py-1 rounded font-medium transition',
              selectedVersion === 'all'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white',
            ]"
          >
            All Tech
          </button>
          <button
            type="button"
            @click="selectedVersion = 'v2'"
            :class="[
              'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
              selectedVersion === 'v2'
                ? 'bg-zinc-800 text-emerald-400'
                : 'text-zinc-400 hover:text-white',
            ]"
          >
            <Rocket class="w-3 h-3" />
            v2
          </button>
          <button
            type="button"
            @click="selectedVersion = 'v1'"
            :class="[
              'px-2.5 py-1 rounded font-medium transition flex items-center gap-1',
              selectedVersion === 'v1'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white',
            ]"
          >
            <Lock class="w-3 h-3" />
            v1
          </button>
        </div>

        <!-- Shadcn Combobox for sorting -->
        <Combobox
          v-model="activeSort"
          :options="sortOptions"
          class="w-40"
          placeholder="Sort tokens"
        />

        <Button @click="$emit('selectTab', 'create')" variant="default" size="sm">
          <Plus class="w-4 h-4 mr-1.5" />
          {{ t('createToken') }}
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 text-emerald-400 animate-spin" />
      <span class="ml-3 text-sm text-zinc-400">Loading tokens...</span>
    </div>

    <!-- API Error State -->
    <div
      v-else-if="apiError"
      class="flex items-start gap-3 bg-amber-950/40 border border-amber-800 rounded-xl p-4 text-sm text-amber-300"
    >
      <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
      <span>Unable to load tokens from the API. Please check that the backend is running.</span>
    </div>

    <!-- Shadcn Empty Component -->
    <Empty
      v-else-if="filteredTokens.length === 0"
      title="No tokens found"
      :description="
        selectedVersion !== 'all'
          ? `No ${selectedVersion.toUpperCase()} tokens launched yet. Be the first to launch one!`
          : 'Be the first creator to deploy a fixed-supply token on Robinhood Chain.'
      "
    >
      <template #action>
        <Button @click="$emit('selectTab', 'create')" size="sm">
          <Plus class="w-3.5 h-3.5 mr-1" /> Launch Token
        </Button>
      </template>
    </Empty>

    <!-- Token Grid -->
    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card
          v-for="item in paginatedTokens"
          :key="item.token.address"
          class="group hover:border-zinc-700 hover:-translate-y-0.5 transition-all flex flex-col justify-between p-5 cursor-pointer"
          @click="$emit('selectToken', item.token.address)"
        >
          <div>
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- Avatar with Jazzicon or Symbol -->
                <Avatar
                  class="w-12 h-12 rounded-xl border border-zinc-700 group-hover:border-emerald-500/50 transition overflow-hidden"
                >
                  <img
                    v-if="item.token.logo && item.token.logo.startsWith('http')"
                    :src="item.token.logo"
                    :alt="item.token.name"
                    class="w-full h-full object-cover"
                  />
                  <AvatarFallback
                    v-else
                    class="bg-zinc-800 text-emerald-400 font-bold text-base rounded-xl"
                  >
                    {{ item.token.symbol.slice(0, 3) }}
                  </AvatarFallback>
                </Avatar>

                <div class="truncate">
                  <div class="flex items-center gap-1.5">
                    <h2
                      class="font-bold text-white text-base truncate group-hover:text-emerald-400 transition"
                    >
                      {{ item.token.name }}
                    </h2>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs font-mono text-zinc-400">${{ item.token.symbol }}</span>
                    <Badge
                      :variant="item.token.version === 'v2' ? 'outline' : 'secondary'"
                      class="text-[9px] px-1.5 py-0 h-4 font-mono uppercase"
                    >
                      {{ item.token.version === 'v2' ? 'v2 Curve' : 'v1 Direct' }}
                    </Badge>
                  </div>
                </div>
              </div>

              <Badge
                v-if="item.marketData.isGraduated"
                variant="graduated"
                class="gap-1 text-[11px] shrink-0"
              >
                <CheckCircle class="w-3 h-3" />
                Graduated
              </Badge>
            </div>

            <p class="text-xs text-zinc-400 mt-3 line-clamp-2 leading-relaxed">
              {{ item.token.description || 'Fixed-supply token on Robinhood Chain.' }}
            </p>
          </div>

          <!-- Price & Graduation Progress Section -->
          <div class="mt-4 pt-4 border-t border-zinc-800/80 space-y-3">
            <div class="flex justify-between items-end">
              <div>
                <p class="text-[11px] text-zinc-400 flex items-center gap-1">
                  <Coins class="w-3 h-3 text-zinc-400" />
                  Price (USD)
                </p>
                <p class="text-sm font-bold font-mono text-white mt-0.5">
                  ${{ item.marketData.priceUsd.toFixed(8) }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-[11px] text-zinc-400">Market Cap</p>
                <p class="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  ${{ item.marketData.marketCapUsd.toLocaleString() }}
                </p>
              </div>
            </div>

            <!-- Graduation Progress Bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-[11px]">
                <span class="text-zinc-400 flex items-center gap-1">
                  <Flame class="w-3 h-3 text-emerald-400" />
                  Progress
                </span>
                <span class="font-mono text-zinc-300 font-medium">
                  {{ (item.marketData.graduationProgress * 100).toFixed(1) }}%
                </span>
              </div>
              <Progress :model-value="item.marketData.graduationProgress * 100" class="h-1.5" />
            </div>
          </div>
        </Card>
      </div>

      <!-- Pagination -->
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
  Sparkles,
  Plus,
  CheckCircle,
  Coins,
  Flame,
  Loader2,
  AlertCircle,
  Rocket,
  Lock,
  TrendingUp,
  Share2,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Combobox } from '@/components/ui/combobox';
import { Empty } from '@/components/ui/empty';
import { Pagination } from '@/components/ui/pagination';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';
import { useI18n } from '@/lib/i18n';

const { t } = useI18n();

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const selectedLifecycle = ref<'all' | 'curve' | 'near_completion' | 'graduated'>('all');
const filterHasSocials = ref(false);
const selectedVersion = ref<'all' | 'v1' | 'v2'>('all');
const activeSort = ref('recent');
const loading = ref(true);
const apiError = ref<string | null>(null);
const allTokens = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);
const currentPage = ref(1);
const pageSize = 6;

const sortOptions = [
  { label: 'Recent Buys', value: 'recent' },
  { label: 'Newest', value: 'newest' },
  { label: 'Market Cap', value: 'mcap' },
  { label: 'Volume (24h)', value: 'volume' },
  { label: 'Graduation', value: 'graduation' },
];

const filteredTokens = computed(() => {
  let list = allTokens.value;

  // Filter by Lifecycle Status (On Curve vs Near Completion vs Graduated)
  if (selectedLifecycle.value === 'curve') {
    list = list.filter((item) => !item.marketData.isGraduated);
  } else if (selectedLifecycle.value === 'near_completion') {
    list = list.filter(
      (item) => !item.marketData.isGraduated && item.marketData.graduationProgress >= 0.8,
    );
  } else if (selectedLifecycle.value === 'graduated') {
    list = list.filter((item) => item.marketData.isGraduated);
  }

  // Filter by Has Socials
  if (filterHasSocials.value) {
    list = list.filter((item) => {
      const soc = item.token.socials;
      return !!(soc && (soc.twitter || soc.telegram || soc.website));
    });
  }
  // Filter by Architecture Version (v1 vs v2)
  if (selectedVersion.value !== 'all') {
    list = list.filter((item) => (item.token.version ?? 'v1') === selectedVersion.value);
  }
  const sorted = [...list];
  if (activeSort.value === 'newest') {
    sorted.sort((a, b) => b.token.createdAt - a.token.createdAt);
  } else if (activeSort.value === 'mcap') {
    sorted.sort((a, b) => b.marketData.marketCapUsd - a.marketData.marketCapUsd);
  } else if (activeSort.value === 'volume') {
    sorted.sort((a, b) => b.marketData.volume24hUsd - a.marketData.volume24hUsd);
  } else if (activeSort.value === 'graduation') {
    sorted.sort((a, b) => b.marketData.graduationProgress - a.marketData.graduationProgress);
  } else {
    // Recent buys / default
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
