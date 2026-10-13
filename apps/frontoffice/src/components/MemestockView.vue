<template>
  <div class="space-y-6">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {{ t('memestock') }}
        </h1>
        <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
          {{ t('memestockSubtitle') }}
        </p>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-auto">
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

    <!-- Navigation Filter Pills (Shadcn Tabs variant="line") + Search Bar (identical to Explore) -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-border text-xs"
    >
      <!-- Filter Tabs -->
      <Tabs v-model="selectedSort" class="w-full md:w-auto">
        <TabsList
          variant="line"
          class="overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-b-0 w-auto"
        >
          <TabsTrigger v-for="tab in memestockTabs" :key="tab.value" :value="tab.value">
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
          placeholder="Search memestocks / address..."
          class="h-8 pl-8 pr-3 text-xs bg-card border-border rounded-xl text-foreground focus-visible:ring-foreground"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 class="w-7 h-7 text-foreground animate-spin" />
      <span class="text-xs text-muted-foreground">{{ t('loadingTape') }}</span>
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
              <div class="relative shrink-0">
                <OptimizedImage
                  :src="item.token.logo"
                  :alt="item.token.name"
                  :fallback-text="item.token.symbol"
                  :width="48"
                  :height="48"
                  class="rounded-xl border border-border group-hover:border-foreground/40 transition shrink-0"
                />
                <img
                  :src="
                    tokenStore.getTokenNetwork(item.token.address).chainId === 5042
                      ? '/chains/arc.svg'
                      : '/chains/robinhood.svg'
                  "
                  :alt="tokenStore.getTokenNetwork(item.token.address).name"
                  :title="tokenStore.getTokenNetwork(item.token.address).name"
                  class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-black bg-black object-contain shadow-xs"
                />
              </div>
              <div class="min-w-0 truncate">
                <h3
                  class="font-bold text-base text-foreground group-hover:opacity-85 transition truncate"
                >
                  {{ item.token.name }}
                </h3>
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                  <span class="font-mono font-semibold">${{ item.token.symbol }}</span>
                  <span>&middot;</span>
                  <span>{{ formatRelativeTime(item.token.createdAt) }}</span>
                  <template v-if="item.token.deployer">
                    <span>&middot;</span>
                    <button
                      type="button"
                      class="hover:text-foreground transition-colors hover:underline underline-offset-2 cursor-pointer truncate max-w-[120px]"
                      :title="`View profile: ${getUserIdentity(item.token.deployer).displayName}`"
                      @click.stop="navigateToDeployer(item.token.deployer)"
                    >
                      {{ getUserIdentity(item.token.deployer).displayName }}
                    </button>
                  </template>
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  class="p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none"
                  :class="
                    isPinned(item.token.address)
                      ? 'text-amber-400'
                      : 'text-muted-foreground/35 hover:text-amber-400'
                  "
                  :title="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
                  @click.stop="togglePin(item.token.address)"
                >
                  <Star
                    class="w-4 h-4"
                    :class="isPinned(item.token.address) ? 'fill-amber-400 text-amber-400' : ''"
                  />
                </button>
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
                <Badge v-if="item.marketData.isGraduated" variant="secondary" class="text-xs">
                  {{ t('graduated') }}
                </Badge>
              </div>
            </div>

            <p class="text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {{
                item.token.description ||
                `Community-backed fixed-supply memestock on ${activeNetwork.name}.`
              }}
            </p>

            <div class="flex items-center gap-2 flex-wrap text-xs font-mono">
              <TaxTooltip
                :buy-tax-bps="item.token.taxConfig?.buyTaxBps"
                :sell-tax-bps="item.token.taxConfig?.sellTaxBps"
              />
              <Badge
                v-if="(item.token.taxConfig?.revenueSplit?.holders ?? 0) > 0"
                variant="outline"
                class="bg-sky-500/10 text-sky-400 border-sky-500/20 py-0 px-1.5 h-4.5 font-normal"
              >
                {{ item.token.taxConfig?.revenueSplit?.holders }}% Dividends
              </Badge>
              <Badge
                v-if="(item.token.taxConfig?.revenueSplit?.buyback ?? 0) > 0"
                variant="outline"
                class="bg-amber-500/10 text-amber-400 border-amber-500/20 py-0 px-1.5 h-4.5 font-normal"
              >
                {{ item.token.taxConfig?.revenueSplit?.buyback }}% Buyback
              </Badge>
              <span class="text-muted-foreground ml-auto">Pool: 1%</span>
            </div>
          </div>

          <div class="mt-5 pt-4 border-t border-border space-y-2">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-xs text-muted-foreground block font-semibold">MARKET CAP</span>
                <span class="font-bold font-mono text-foreground">
                  {{ formatCompactUsd(item.marketData.marketCapUsd) }}
                </span>
              </div>
              <div class="text-right">
                <span class="text-xs text-muted-foreground block font-semibold">VOLUME 24H</span>
                <span class="font-semibold font-mono text-muted-foreground">
                  {{
                    (item.marketData.volume24hUsd || 0) > 0
                      ? formatCompactUsd(item.marketData.volume24hUsd)
                      : '—'
                  }}
                </span>
              </div>
            </div>
            <div class="flex justify-between text-xs pt-1">
              <span class="text-muted-foreground">Graduation ({{ graduationTargetDisplay }})</span>
              <span class="text-foreground font-mono font-semibold">
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
import { useRouter } from 'vue-router';
import { Plus, Loader2, AlertCircle, RefreshCw, Search, Star } from 'lucide-vue-next';
import { apiFetch } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty } from '@/components/ui/empty';
import { Pagination } from '@/components/ui/pagination';
import TaxTooltip from '@/components/ui/TaxTooltip.vue';
import { ARC_CHAIN, type LaunchedTokenEntity, type TokenMarketData } from '@proto/shared-types';
import { formatCompactUsd, formatRelativeTime, shortenAddress } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { usePinnedTokens } from '@/composables/usePinnedTokens';

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'selectTab', tab: string): void;
}>();

const { t } = useI18n();
const { activeNetwork } = useWallet();
const tokenStore = useTokenStore();

const router = useRouter();
const { isPinned, togglePin, pinnedTokens } = usePinnedTokens();

function navigateToDeployer(deployerAddress: string) {
  if (!deployerAddress) return;
  router.push(`/${getUserIdentity(deployerAddress).name}`);
}

const memestockTabs = computed(() => [
  { label: 'Trending', value: 'Trending' },
  { label: 'New', value: 'Newest' },
  { label: 'Dividends', value: 'Dividends' },
  { label: 'Top Gainers', value: 'Top Gainers' },
  { label: 'High Vol', value: 'Highest Volume' },
  { label: `Pinned (${pinnedTokens.value.size})`, value: 'Pinned' },
]);

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

  if (selectedSort.value === 'Pinned') {
    return [...list].filter((item) => isPinned(item.token.address));
  }
  if (selectedSort.value === 'Newest') {
    return [...list].sort((a, b) => b.token.createdAt - a.token.createdAt);
  }
  if (selectedSort.value === 'Dividends') {
    return [...list]
      .filter((item) => (item.token.taxConfig?.revenueSplit?.holders ?? 0) > 0)
      .sort((a, b) => (b.marketData.marketCapUsd ?? 0) - (a.marketData.marketCapUsd ?? 0));
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
    const envelope = await apiFetch<{
      success: boolean;
      data: Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>;
      error?: { message?: string };
    }>('/api/tokens');
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
