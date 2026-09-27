<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-bold tracking-tight text-foreground">
            {{ t('protocolAnalytics') }}
          </h1>
        </div>
        <p class="text-sm mt-1 text-muted-foreground">
          {{ t('analyticsSubtitle') }}
        </p>
      </div>

      <!-- Refresh Action -->
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted text-foreground self-start md:self-auto cursor-pointer"
        @click="fetchAnalytics"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>

    <!-- Error Banner -->
    <div
      v-if="fetchError"
      class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center justify-between gap-3"
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

    <!-- Stats Grid with Shadcn Card -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
      <Card class="p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold font-mono text-muted-foreground">
          {{ t('totalTradingVolume') }}
        </p>
        <p class="text-2xl font-bold font-mono text-foreground mt-2">${{ formattedVolume }}</p>
        <p class="text-xs text-muted-foreground mt-2 font-medium">
          {{ t('fromYesterday') }}
        </p>
      </Card>

      <Card class="p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold font-mono text-muted-foreground">
          {{ t('totalTokensLaunched') }}
        </p>
        <p class="text-2xl font-bold font-mono text-foreground mt-2">
          {{ totalTokens.toLocaleString() }}
        </p>
        <p class="text-xs text-muted-foreground mt-2 font-medium">
          {{ t('permanentlyLocked') }}
        </p>
      </Card>

      <Card class="p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold font-mono text-muted-foreground">
          {{ t('protocolBuybackAndBurn') }}
        </p>
        <p class="text-2xl font-bold font-mono text-foreground mt-2">${{ formattedBuyback }}</p>
        <p class="text-xs text-muted-foreground mt-2 font-medium">
          {{ t('protocolFeesBurned') }}
        </p>
      </Card>
    </div>

    <!-- Analytics Chart Section -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
      <Card class="p-6 sm:p-7 rounded-2xl border border-border bg-card space-y-5 shadow-xs">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-foreground">
              {{ t('volumeAndLiquidity') }}
            </h2>
            <p class="text-xs text-muted-foreground">
              {{ t('hourlyAggregatedVolume') }}
            </p>
          </div>
          <Badge variant="secondary">24h History</Badge>
        </div>

        <ReactiveBarChart :data="volumeChartData" :height="180" :is-currency="true" />
      </Card>

      <Card class="p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-foreground">
              {{ t('totalTokensLaunched') }}
            </h2>
            <p class="text-xs text-muted-foreground">Token deployments over 24h</p>
          </div>
          <Badge variant="secondary">{{ activeNetwork.name }}</Badge>
        </div>

        <ReactiveBarChart :data="tokenChartData" :height="180" unit="tokens" />
      </Card>
    </div>

    <!-- Contracts Table -->
    <Card class="p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-base font-bold text-foreground">{{ t('deployedContracts') }}</h2>
          <p class="text-xs text-muted-foreground">
            Verified protocol smart contracts on {{ activeNetwork.name }}
          </p>
        </div>
        <Badge variant="outline" class="font-mono text-xs self-start sm:self-auto">
          Chain ID: {{ activeNetwork.chainId }}
        </Badge>
      </div>

      <div class="space-y-3 font-mono text-xs">
        <div
          v-for="c in contractEntries"
          :key="c.name"
          class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border gap-2"
        >
          <div class="flex items-center gap-2">
            <span class="text-foreground font-medium">{{ c.name }}</span>
            <Badge
              v-if="isContractDeployed(c.address)"
              variant="secondary"
              class="text-[10px] py-0 px-1.5 font-mono"
            >
              Active
            </Badge>
            <Badge
              v-else
              variant="outline"
              class="text-[10px] py-0 px-1.5 font-mono text-muted-foreground"
            >
              Pending
            </Badge>
          </div>

          <div class="flex items-center gap-2">
            <span
              class="text-foreground font-semibold select-all break-all sm:break-normal text-[11px] sm:text-xs"
            >
              {{ c.address }}
            </span>

            <Button
              v-if="isContractDeployed(c.address)"
              as-child
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
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
              class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              :title="copiedAddress === c.address ? 'Copied!' : 'Copy contract address'"
              :aria-label="`Copy ${c.name} contract address`"
              @click="copyContractAddress(c.address)"
            >
              <Check v-if="copiedAddress === c.address" class="w-3.5 h-3.5 text-foreground" />
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
import { RefreshCw, ExternalLink, Copy, Check, AlertCircle } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '@/composables/useWallet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ReactiveBarChart, { type ChartDataPoint } from '@/components/ui/chart/ReactiveBarChart.vue';

const { t } = useI18n();
const { activeNetwork } = useWallet();

const totalVolume = ref(0);
const totalTokens = ref(0);
const totalBuyback = ref<string | number>(0);
const loading = ref(false);
const fetchError = ref<string | null>(null);
const copiedAddress = ref<string | null>(null);

const formattedVolume = computed(() => {
  const val = Number(totalVolume.value) || 0;
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
});

const formattedBuyback = computed(() => {
  const val = Number(totalBuyback.value) || 0;
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
