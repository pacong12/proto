<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-bold tracking-tight">{{ t('protocolAnalytics') }}</h1>
        </div>
        <p class="text-sm mt-1">
          {{ t('analyticsSubtitle') }}
        </p>
      </div>
    </div>

    <!-- Stats Grid with Shadcn Card -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
      <Card class="p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold font-mono">
          {{ t('totalTradingVolume') }}
        </p>
        <p class="text-2xl font-bold font-mono mt-2">${{ totalVolume.toLocaleString() }}</p>
        <p class="text-xs text-muted-foreground mt-2 font-medium">
          {{ t('fromYesterday') }}
        </p>
      </Card>

      <Card class="p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold font-mono">
          {{ t('totalTokensLaunched') }}
        </p>
        <p class="text-2xl font-bold font-mono mt-2">
          {{ totalTokens }}
        </p>
        <p class="text-xs text-muted-foreground mt-2 font-medium">
          {{ t('permanentlyLocked') }}
        </p>
      </Card>

      <Card class="p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-xs space-y-2">
        <p class="text-xs uppercase font-semibold font-mono">
          {{ t('protocolBuybackAndBurn') }}
        </p>
        <p class="text-2xl font-bold font-mono text-foreground mt-2">{{ totalBuyback }} ETH</p>
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
            <h2 class="text-base font-bold">
              {{ t('volumeAndLiquidity') }}
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
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
            <h2 class="text-base font-bold">
              {{ t('totalTokensLaunched') }}
            </h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Token deployments over 24h</p>
          </div>
          <Badge variant="graduated">{{ activeNetwork.name }}</Badge>
        </div>

        <ReactiveBarChart :data="tokenChartData" :height="180" unit="tokens" />
      </Card>
    </div>

    <!-- Contracts Table -->
    <Card class="p-6 space-y-4">
      <h2 class="text-base font-bold text-black dark:text-white">{{ t('deployedContracts') }}</h2>
      <div class="space-y-3 font-mono text-xs">
        <div
          v-for="c in contractEntries"
          :key="c.name"
          class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800/80 gap-1.5"
        >
          <span class="text-foreground font-medium sm:font-normal">{{ c.name }}</span>
          <span
            class="text-foreground font-semibold select-all break-all sm:break-normal text-[11px] sm:text-xs"
            >{{ c.address }}</span
          >
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '@/composables/useWallet';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';

const { t } = useI18n();
const { activeNetwork } = useWallet();
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactiveBarChart, { type ChartDataPoint } from '@/components/ui/chart/ReactiveBarChart.vue';

const totalVolume = ref(0);
const totalTokens = ref(0);
const totalBuyback = ref(0);

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

onMounted(async () => {
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
    }
  } catch {
    // Fallback gracefully
  }
});
</script>
