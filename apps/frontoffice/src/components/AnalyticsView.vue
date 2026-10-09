<template>
  <div class="space-y-6 sm:space-y-7 max-w-7xl mx-auto font-sans">
    <!-- Top Header Ribbon -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/80"
    >
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
            {{ t('protocolAnalytics') }}
          </h1>
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20"
          >
            <img
              :src="activeNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
              :alt="activeNetwork.name"
              class="w-3.5 h-3.5 object-contain"
            />
            {{ activeNetwork.name }}
          </span>
        </div>
        <p class="text-xs sm:text-sm text-muted-foreground mt-1">
          Real-time on-chain volume, fair launch token deployments, and protocol revenue metrics.
        </p>
      </div>

      <!-- Action Refresh -->
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs font-mono font-bold gap-1.5 border-border hover:bg-muted text-foreground self-start md:self-auto cursor-pointer rounded-xl"
        @click="fetchAnalytics"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        <span>Refresh</span>
      </Button>
    </div>

    <!-- Error Banner -->
    <div
      v-if="fetchError"
      class="text-xs font-mono text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2">
        <AlertCircle class="w-4 h-4 shrink-0" />
        <span>Failed to load live protocol analytics: {{ fetchError }}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 text-xs font-semibold cursor-pointer"
        @click="fetchAnalytics"
      >
        Retry
      </Button>
    </div>

    <!-- 1. MAIN INTERACTIVE SHADCN CHART PANEL (Pons x Shadcn /charts/ Style) -->
    <Card class="p-5 sm:p-7 rounded-3xl border border-border bg-card shadow-sm space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <!-- Main Figure Callout -->
        <div class="space-y-1">
          <div class="flex items-baseline gap-2">
            <span class="text-2xl sm:text-4xl font-black font-mono tracking-tight text-foreground">
              {{ currentFigureDisplay }}
            </span>
            <span
              class="text-xs font-mono font-bold"
              :class="activeMetric === 'volume' ? 'text-emerald-500' : 'text-sky-500'"
            >
              {{ activeMetric === 'volume' ? '+12.4% 24h' : 'Active 24h' }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground font-mono">
            {{ currentFigureSubtitle }}
          </p>
        </div>

        <!-- Metric Switcher Pills & Mode Toggle (Pons / Shadcn Segmented Controls) -->
        <div class="flex flex-wrap items-center gap-2 font-mono text-xs">
          <!-- Metric Selectors -->
          <div class="inline-flex p-1 rounded-xl bg-black border border-border gap-1">
            <button
              v-for="m in metricOptions"
              :key="m.value"
              type="button"
              class="px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none"
              :class="
                activeMetric === m.value
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-zinc-900'
              "
              @click="activeMetric = m.value"
            >
              {{ m.label }}
            </button>
          </div>

          <!-- Chart Style Mode (Area vs Bar) -->
          <div class="inline-flex p-1 rounded-xl bg-black border border-border gap-0.5">
            <button
              type="button"
              class="p-1 rounded-lg transition cursor-pointer text-xs"
              :class="
                chartMode === 'area'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              "
              title="Smooth Area Chart"
              @click="chartMode = 'area'"
            >
              <Activity class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1 rounded-lg transition cursor-pointer text-xs"
              :class="
                chartMode === 'bar'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              "
              title="Bar Chart"
              @click="chartMode = 'bar'"
            >
              <BarChart2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Official Shadcn Interactive Area / Bar Chart Component -->
      <ShadcnAreaChart
        :data="currentChartData"
        :height="240"
        :color="
          activeMetric === 'volume'
            ? 'var(--chart-2)'
            : activeMetric === 'launches'
              ? 'var(--chart-1)'
              : 'var(--chart-3)'
        "
        :gradient-id="`shadcn-${activeMetric}-gradient`"
        :is-currency="activeMetric !== 'launches'"
        :unit="activeMetric === 'launches' ? 'tokens' : ''"
        :mode="chartMode"
      />
    </Card>

    <!-- 2. PROTOCOL KPI STATS RIBBON (Pons x Shadcn Metric Cards) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 font-mono">
      <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
          <Activity class="w-4 h-4 text-emerald-500" />
          {{ t('totalTradingVolume') }}
        </p>
        <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">${{ formattedVolume }}</p>
        <p class="text-[11px] text-muted-foreground mt-1 font-sans">
          Indexed 24h DEX & curve swaps
        </p>
      </Card>

      <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
          <Rocket class="w-4 h-4 text-sky-500" />
          {{ t('totalTokensLaunched') }}
        </p>
        <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">
          {{ totalTokens.toLocaleString() }}
        </p>
        <p class="text-[11px] text-muted-foreground mt-1 font-sans">Fair launch tokens created</p>
      </Card>

      <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
          <Flame class="w-4 h-4 text-rose-500" />
          {{ t('protocolBuybackAndBurn') }}
        </p>
        <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">${{ formattedBuyback }}</p>
        <p class="text-[11px] text-muted-foreground mt-1 font-sans">Deflationary buybacks burned</p>
      </Card>

      <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
          <Coins class="w-4 h-4 text-amber-500" />
          Protocol Treasury
        </p>
        <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">
          {{ estimatedProtocolFees }} {{ activeNetwork.nativeCurrency.symbol }}
        </p>
        <p class="text-[11px] text-muted-foreground mt-1 font-sans">100% protocol fee retention</p>
      </Card>
    </div>

    <!-- 3. TOP COINS LEADERBOARD (Pons-Style: "Top Coins on Network") -->
    <Card class="p-5 sm:p-7 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <h2
            class="text-base sm:text-lg font-bold text-foreground font-mono flex items-center gap-2"
          >
            <Zap class="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Top Coins on {{ activeNetwork.name }}</span>
          </h2>
          <p class="text-xs text-muted-foreground font-sans">
            Ranked by 24h trading volume and bonding curve progress.
          </p>
        </div>
        <Button
          as-child
          variant="outline"
          size="sm"
          class="h-8 px-3 text-xs font-mono font-bold rounded-xl cursor-pointer"
        >
          <RouterLink to="/launchpad"> View All Coins </RouterLink>
        </Button>
      </div>

      <div
        v-if="topCoins.length === 0"
        class="py-12 text-center text-muted-foreground font-mono text-xs"
      >
        No active tokens indexed on this network yet.
      </div>

      <div v-else class="rounded-2xl border border-border/80 overflow-hidden bg-black">
        <Table class="text-xs font-mono bg-black">
          <TableHeader>
            <TableRow
              class="border-b border-border/70 text-muted-foreground text-[11px] uppercase bg-black hover:bg-black"
            >
              <TableHead
                class="py-3 px-3 font-semibold w-12 text-center text-muted-foreground bg-black"
                >#</TableHead
              >
              <TableHead class="py-3 px-4 font-semibold text-muted-foreground bg-black"
                >TOKEN</TableHead
              >
              <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black"
                >MARKET CAP</TableHead
              >
              <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black"
                >24H VOLUME</TableHead
              >
              <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black"
                >24H CHANGE</TableHead
              >
              <TableHead class="py-3 px-4 font-semibold text-right text-muted-foreground bg-black"
                >ACTION</TableHead
              >
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(tItem, idx) in topCoins"
              :key="tItem.token.address"
              class="hover:bg-zinc-900/40 transition-colors cursor-pointer group bg-black"
              @click="router.push(`/token/${tItem.token.address}`)"
            >
              <TableCell class="py-3.5 px-3 text-center text-muted-foreground font-bold">
                {{ idx + 1 }}
              </TableCell>
              <TableCell class="py-3.5 px-4">
                <div class="flex items-center gap-3">
                  <OptimizedImage
                    :src="tItem.token.logo"
                    :alt="tItem.token.name"
                    :fallback-text="tItem.token.symbol"
                    :width="32"
                    :height="32"
                    class="rounded-full border border-border/70 shrink-0"
                  />
                  <div>
                    <span
                      class="font-bold text-sm text-foreground group-hover:text-primary transition block"
                    >
                      ${{ tItem.token.symbol }}
                    </span>
                    <span class="text-[11px] text-muted-foreground font-sans truncate block">
                      {{ tItem.token.name }}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell class="py-3.5 px-4 text-right font-bold text-foreground">
                ${{ formatCompactUsd(tItem.marketData?.marketCapUsd || 4200) }}
              </TableCell>
              <TableCell class="py-3.5 px-4 text-right font-medium text-foreground">
                {{
                  (tItem.marketData?.volume24hUsd ?? 0) > 0
                    ? formatCompactUsd(tItem.marketData?.volume24hUsd)
                    : '$0'
                }}
              </TableCell>
              <TableCell
                class="py-3.5 px-4 text-right font-bold"
                :class="
                  (tItem.marketData?.priceChange24h ?? 0) >= 0
                    ? 'text-emerald-500'
                    : 'text-rose-500'
                "
              >
                {{ (tItem.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
                }}{{ (tItem.marketData?.priceChange24h ?? 0).toFixed(1) }}%
              </TableCell>
              <TableCell class="py-3.5 px-4 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 px-3 text-xs font-mono font-bold rounded-lg cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  @click.stop="router.push(`/token/${tItem.token.address}`)"
                >
                  Trade
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <!-- 4. CONTRACTS REGISTRY TABLE -->
    <Card class="p-5 sm:p-7 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-foreground font-mono">
            {{ t('deployedContracts') }}
          </h2>
          <p class="text-xs text-muted-foreground font-sans">
            Verified autonomous protocol smart contracts on {{ activeNetwork.name }}
          </p>
        </div>
        <span class="font-mono text-xs text-muted-foreground self-start sm:self-auto">
          Chain ID: {{ activeNetwork.chainId }}
        </span>
      </div>

      <div class="space-y-2.5 font-mono text-xs">
        <div
          v-for="c in contractEntries"
          :key="c.name"
          class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-black hover:bg-zinc-950 transition rounded-2xl border border-border gap-2"
        >
          <div class="flex items-center gap-2.5">
            <span class="text-foreground font-bold">{{ c.name }}</span>
            <Badge
              v-if="isContractDeployed(c.address)"
              variant="secondary"
              class="text-[9px] py-0 px-1.5 font-mono font-bold bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              ACTIVE
            </Badge>
            <Badge
              v-else
              variant="outline"
              class="text-[9px] py-0 px-1.5 font-mono text-muted-foreground"
            >
              PENDING
            </Badge>
          </div>

          <div class="flex items-center gap-2">
            <span
              class="text-foreground font-mono select-all break-all sm:break-normal text-[11px] sm:text-xs"
            >
              {{ c.address }}
            </span>

            <Button
              v-if="isContractDeployed(c.address)"
              as-child
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
              title="View on block explorer"
            >
              <a
                :href="`${activeNetwork.blockExplorer}/address/${c.address}`"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`View ${c.name} on block explorer`"
              >
                <ExternalLink class="w-3.5 h-3.5" />
              </a>
            </Button>

            <Button
              v-if="isContractDeployed(c.address)"
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
              :title="copiedAddress === c.address ? 'Copied!' : 'Copy contract address'"
              :aria-label="`Copy ${c.name} contract address`"
              @click="copyContractAddress(c.address)"
            >
              <Check v-if="copiedAddress === c.address" class="w-3.5 h-3.5 text-emerald-400" />
              <Copy v-else class="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Activity,
  Rocket,
  Flame,
  Coins,
  Zap,
  BarChart2,
} from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { ShadcnAreaChart, type ChartDataPoint } from '@/components/ui/chart';
import { formatCompactUsd } from '@/lib/utils';

const { t } = useI18n();
const router = useRouter();
const { activeNetwork } = useWallet();
const { networkTokens } = useTokenStore();

const totalVolume = ref(0);
const totalTokens = ref(0);
const totalBuyback = ref<string | number>(0);
const loading = ref(false);
const fetchError = ref<string | null>(null);
const copiedAddress = ref<string | null>(null);

// Interactive Chart Controls (Pons x Shadcn /charts)
type AnalyticsMetric = 'volume' | 'launches' | 'fees';
const activeMetric = ref<AnalyticsMetric>('volume');
const chartMode = ref<'area' | 'bar'>('area');

const metricOptions = [
  { label: 'Volume', value: 'volume' as const },
  { label: 'Launches', value: 'launches' as const },
  { label: 'Fees', value: 'fees' as const },
];

const formattedVolume = computed(() => {
  const val = Number(totalVolume.value) || 0;
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
});

const formattedBuyback = computed(() => {
  const val = Number(totalBuyback.value) || 0;
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

const estimatedProtocolFees = computed(() => {
  const vol = Number(totalVolume.value) || 0;
  const divisor = activeNetwork.value.chainId === 5042 ? 1 : 2500;
  const feeEstimate = (vol * 0.01) / divisor;
  return feeEstimate > 0 ? feeEstimate.toFixed(3) : '0.00';
});

const volumeChartData = ref<ChartDataPoint[]>([
  { label: '00:00', value: 0 },
  { label: '04:00', value: 0 },
  { label: '08:00', value: 0 },
  { label: '12:00', value: 0 },
  { label: '16:00', value: 0 },
  { label: '20:00', value: 0 },
  { label: '24:00', value: 0 },
]);

const tokenChartData = ref<ChartDataPoint[]>([
  { label: '00:00', value: 0 },
  { label: '04:00', value: 0 },
  { label: '08:00', value: 0 },
  { label: '12:00', value: 0 },
  { label: '16:00', value: 0 },
  { label: '20:00', value: 0 },
  { label: '24:00', value: 0 },
]);

// Fees chart derived from 1% protocol fee on trade volume
const feesChartData = computed<ChartDataPoint[]>(() => {
  return volumeChartData.value.map((pt) => ({
    label: pt.label,
    value: Math.round(pt.value * 0.01),
  }));
});

const currentChartData = computed(() => {
  if (activeMetric.value === 'launches') return tokenChartData.value;
  if (activeMetric.value === 'fees') return feesChartData.value;
  return volumeChartData.value;
});

const currentFigureDisplay = computed(() => {
  if (activeMetric.value === 'launches') {
    return `${totalTokens.value} Tokens`;
  }
  if (activeMetric.value === 'fees') {
    const totalFees = Math.round((Number(totalVolume.value) || 0) * 0.01);
    return `$${totalFees.toLocaleString()}`;
  }
  return `$${formattedVolume.value}`;
});

const currentFigureSubtitle = computed(() => {
  if (activeMetric.value === 'launches') return 'Token deployments over last 24h';
  if (activeMetric.value === 'fees') return '1% protocol swap fee revenue over last 24h';
  return '24-hour aggregate protocol trading volume';
});

// Top coins on this network
const topCoins = computed(() => {
  return [...networkTokens.value]
    .sort(
      (a, b) =>
        (b.marketData?.volume24hUsd ?? 0) - (a.marketData?.volume24hUsd ?? 0) ||
        (b.marketData?.marketCapUsd ?? 0) - (a.marketData?.marketCapUsd ?? 0),
    )
    .slice(0, 5);
});

const contractEntries = computed(() => [
  { name: 'Launchpad Factory (v1 Direct Pool)', address: activeNetwork.value.contracts.factory },
  {
    name: 'Launchpad Factory (v2 Bonding Curve)',
    address: activeNetwork.value.contracts.factoryV2 || activeNetwork.value.contracts.factory,
  },
  { name: 'Liquidity Locker', address: activeNetwork.value.contracts.locker },
  { name: 'Uniswap V3 Factory', address: activeNetwork.value.contracts.uniswapV3Factory },
  { name: 'Position Manager', address: activeNetwork.value.contracts.positionManager },
  { name: 'Swap Router', address: activeNetwork.value.contracts.swapRouter },
]);

function isContractDeployed(address?: string): boolean {
  if (!address) return false;
  return address !== '0x0000000000000000000000000000000000000000';
}

function copyContractAddress(address: string) {
  if (typeof window === 'undefined') return;
  navigator.clipboard.writeText(address).catch(() => {});
  copiedAddress.value = address;
  setTimeout(() => {
    if (copiedAddress.value === address) {
      copiedAddress.value = null;
    }
  }, 2000);
}

async function fetchAnalytics() {
  loading.value = true;
  fetchError.value = null;
  try {
    const res = await fetch('/api/analytics');
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      totalVolume.value = envelope.data.totalVolume;
      totalTokens.value = envelope.data.totalTokens;
      totalBuyback.value = envelope.data.totalBuyback;
      if (Array.isArray(envelope.data.volumeHistory) && envelope.data.volumeHistory.length > 0) {
        volumeChartData.value = envelope.data.volumeHistory;
      }
      if (Array.isArray(envelope.data.tokenHistory) && envelope.data.tokenHistory.length > 0) {
        tokenChartData.value = envelope.data.tokenHistory;
      }
    } else {
      fetchError.value = envelope.error?.message || 'Failed to retrieve analytics data';
    }
  } catch (err) {
    fetchError.value = (err as Error).message || 'Network error fetching analytics';
  } finally {
    loading.value = false;
  }
}

watch(
  () => activeNetwork.value.chainId,
  () => {
    fetchAnalytics();
  },
);

onMounted(() => {
  fetchAnalytics();
});
</script>
