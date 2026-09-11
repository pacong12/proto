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
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card class="p-5">
        <p class="text-xs uppercase font-semibold font-mono">
          {{ t('totalTradingVolume') }}
        </p>
        <p class="text-2xl font-bold font-mono mt-2">${{ totalVolume.toLocaleString() }}</p>
        <p class="text-xs text-emerald-500 dark:text-emerald-400 mt-2 font-medium">
          {{ t('fromYesterday') }}
        </p>
      </Card>

      <Card class="p-5">
        <p class="text-xs uppercase font-semibold font-mono">
          {{ t('totalTokensLaunched') }}
        </p>
        <p class="text-2xl font-bold font-mono mt-2">
          {{ totalTokens }}
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
          {{ t('permanentlyLocked') }}
        </p>
      </Card>

      <Card class="p-5">
        <p class="text-xs uppercase font-semibold font-mono">
          {{ t('protocolBuybackAndBurn') }}
        </p>
        <p class="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-2">
          {{ totalBuyback }} ETH
        </p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
          {{ t('protocolFeesBurned') }}
        </p>
      </Card>
    </div>

    <!-- Analytics Chart Section -->
    <Card class="p-6 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold">
            {{ t('volumeAndLiquidity') }}
          </h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ t('hourlyAggregatedVolume') }}</p>
        </div>
        <div class="flex gap-2">
          <Badge variant="secondary">Robinhood L2</Badge>
          <Badge variant="graduated">1% Uniswap V3</Badge>
        </div>
      </div>

      <SimpleChart :data="chartData" :height="220" />
    </Card>

    <!-- Contracts Table -->
    <Card class="p-6 space-y-4">
      <h2 class="text-base font-bold text-black dark:text-white">{{ t('deployedContracts') }}</h2>
      <div class="space-y-3 font-mono text-xs">
        <div
          v-for="c in contractEntries"
          :key="c.name"
          class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800/80"
        >
          <span>{{ c.name }}</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-semibold select-all">{{
            c.address
          }}</span>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '@/lib/i18n';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';

const { t } = useI18n();
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
const totalVolume = ref(0);
const totalTokens = ref(0);
const totalBuyback = ref(0);

const chartData = ref([
  { label: '00:00', value: 0 },
  { label: '04:00', value: 0 },
  { label: '08:00', value: 0 },
  { label: '12:00', value: 0 },
  { label: '16:00', value: 0 },
  { label: '20:00', value: 0 },
  { label: '24:00', value: 0 },
]);

const contractEntries = [
  { name: 'Launchpad Factory (v1 Direct Pool)', address: ROBINHOOD_CHAIN.contracts.factory },
  {
    name: 'Launchpad Factory (v2 Bonding Curve)',
    address: ROBINHOOD_CHAIN.contracts.factoryV2 || '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  },
  { name: 'Liquidity Locker', address: ROBINHOOD_CHAIN.contracts.locker },
  { name: 'Uniswap V3 Factory', address: ROBINHOOD_CHAIN.contracts.uniswapV3Factory },
  { name: 'Position Manager', address: ROBINHOOD_CHAIN.contracts.positionManager },
  { name: 'Swap Router', address: ROBINHOOD_CHAIN.contracts.swapRouter },
];

onMounted(async () => {
  try {
    const res = await fetch('/api/analytics');
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      totalVolume.value = envelope.data.totalVolume;
      totalTokens.value = envelope.data.totalTokens;
      totalBuyback.value = envelope.data.totalBuyback;
    }
  } catch {
    // Fallback gracefully
  }
});
</script>
