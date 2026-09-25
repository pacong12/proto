<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-bold tracking-tight">{{ t('memestock') }}</h1>
          <Badge variant="graduated" class="text-xs"> {{ t('trendingFeed') }} </Badge>
        </div>
        <p class="text-sm mt-1">
          {{ t('memestockSubtitle') }}
        </p>
      </div>

      <div
        class="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto"
      >
        <!-- Shadcn Tabs for Filtering -->
        <Tabs v-model="selectedSort" class="overflow-x-auto no-scrollbar flex-1 sm:flex-initial">
          <TabsList class="overflow-x-auto no-scrollbar shrink-0">
            <TabsTrigger value="Trending">
              {{ t('trending') }}
            </TabsTrigger>
            <TabsTrigger value="Top Gainers">
              {{ t('topGainers') }}
            </TabsTrigger>
            <TabsTrigger value="Highest Volume">
              {{ t('highestVolume') }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          @click="$emit('selectTab', 'create')"
          variant="default"
          size="sm"
          class="h-9 px-3 sm:px-4 gap-1.5 font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus class="w-4 h-4" />
          {{ t('create') }}
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 text-emerald-400 animate-spin" />
      <span class="ml-3 text-sm">{{ t('loadingTape') }}</span>
    </div>

    <!-- Error Banner -->
    <Card v-else-if="apiError" class="border-amber-800 bg-amber-950/40 p-4">
      <div class="flex items-start gap-3 text-sm text-amber-400">
        <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
        <span>{{ apiError }}</span>
      </div>
    </Card>

    <!-- Empty State using Shadcn Empty -->
    <Empty
      v-else-if="items.length === 0"
      :title="t('noMemesTitle')"
      :description="t('noMemesDesc')"
    >
      <template #action>
        <Button
          @click="$emit('selectTab', 'create')"
          variant="default"
          size="default"
          class="font-bold gap-2 shadow-md"
        >
          <Plus class="w-4 h-4" />
          {{ t('launchNow') }}
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
                  <h3 class="font-bold text-base group-hover:text-foreground transition truncate">
                    {{ item.token.name }}
                  </h3>
                  <p class="text-xs font-mono text-muted-foreground">${{ item.token.symbol }}</p>
                </div>
              </div>

              <Badge v-if="item.marketData.isGraduated" variant="outline" class="text-[10px]">
                {{ t('graduated') }}
              </Badge>
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

          <div class="mt-5 pt-4 border-t border-zinc-800 space-y-2">
            <div class="flex justify-between text-xs font-mono">
              <span>Market Cap</span>
              <span class="font-semibold">{{
                formatCompactUsd(item.marketData.marketCapUsd)
              }}</span>
            </div>
            <div class="flex justify-between text-xs font-mono">
              <span
                >Graduation ({{
                  activeNetwork.nativeCurrency.symbol === 'USDC' ? '8.4K USDC' : '4.2 ETH'
                }})</span
              >
              <span class="text-emerald-400 font-semibold">
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
        v-if="items.length > pageSize"
        :total="items.length"
        :items-per-page="pageSize"
        :page="currentPage"
        @update:page="currentPage = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { TrendingUp, Plus, Loader2, AlertCircle } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const { t } = useI18n();
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty } from '@/components/ui/empty';
import { Pagination } from '@/components/ui/pagination';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';
import { formatCompactUsd } from '@/lib/utils';
import { useWallet } from '@/composables/useWallet';

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const { activeNetwork } = useWallet();

const selectedSort = ref('Trending');
const loading = ref(true);
const apiError = ref<string | null>(null);
const items = ref<Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>>([]);

const currentPage = ref(1);
const pageSize = 6;

watch(selectedSort, () => {
  currentPage.value = 1;
});

const sortedItems = computed(() => {
  const list = [...items.value];
  if (selectedSort.value === 'Top Gainers') {
    return list.sort(
      (a, b) => (b.marketData.priceChange24h ?? 0) - (a.marketData.priceChange24h ?? 0),
    );
  }
  if (selectedSort.value === 'Highest Volume') {
    return list.sort((a, b) => (b.marketData.volume24hUsd || 0) - (a.marketData.volume24hUsd || 0));
  }
  // Default 'Trending'
  return list.sort(
    (a, b) =>
      (b.marketData.volume24hUsd || 0) +
      b.marketData.graduationProgress * 1000 -
      ((a.marketData.volume24hUsd || 0) + a.marketData.graduationProgress * 1000),
  );
});

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return sortedItems.value.slice(start, start + pageSize);
});

onMounted(async () => {
  try {
    const res = await fetch('/api/tokens');
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      items.value = envelope.data;
    } else {
      apiError.value = envelope.error?.message || 'Unable to fetch memestock feed';
    }
  } catch (err) {
    apiError.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>
