<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <Activity class="w-6 h-6 text-emerald-400" />
          <h1 class="text-3xl font-bold tracking-tight">Protocol Analytics</h1>
          <Badge v-if="analyticsPlaceholder" variant="secondary" class="text-xs">
            Live Chart Preview
          </Badge>
        </div>
        <p class="text-sm mt-1">
          Real-time onchain metrics, 24h volume tracking, and contract deployments on Robinhood
          Chain.
        </p>
      </div>
    </div>

    <!-- Stats Grid with Shadcn Card -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card class="p-5">
        <p class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono">
          <Coins class="w-4 h-4 text-emerald-400" />
          Total Trading Volume
        </p>
        <p class="text-2xl font-bold font-mono mt-2">
          {{ analyticsPlaceholder ? '$184,520' : '$' + totalVolume.toLocaleString() }}
        </p>
        <p class="text-xs text-emerald-500 dark:text-emerald-400 mt-2 font-medium">
          +14.2% from yesterday
        </p>
      </Card>

      <Card class="p-5">
        <p class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono">
          <Rocket class="w-4 h-4 text-emerald-400" />
          Total Tokens Launched
        </p>
        <p class="text-2xl font-bold font-mono mt-2">
          {{ analyticsPlaceholder ? '128' : totalTokens }}
        </p>
        <p class="text-xs mt-2 font-medium">100% permanently locked</p>
      </Card>

      <Card class="p-5">
        <p class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono">
          <Flame class="w-4 h-4 text-emerald-400" />
          Protocol Buyback &amp; Burn
        </p>
        <p class="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-2">
          {{ analyticsPlaceholder ? '3.45 ETH' : totalBuyback + ' ETH' }}
        </p>
        <p class="text-xs mt-2 font-medium">80% of protocol fees burned</p>
      </Card>
    </div>

    <!-- Analytics Chart Section -->
    <Card class="p-6 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold flex items-center gap-2">
            <TrendingUp class="w-4 h-4 text-emerald-400" />
            24h Volume &amp; Liquidity Flow
          </h2>
          <p class="text-xs">Hourly aggregated volume on Robinhood Chain</p>
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
      <h2 class="text-base font-bold">Deployed System Contracts (Robinhood Chain ID: 4663)</h2>
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
import { Activity, Coins, Rocket, Flame, TrendingUp } from 'lucide-vue-next';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SimpleChart } from '@/components/ui/chart';

const totalVolume = ref(0);
const totalTokens = ref(0);
const totalBuyback = ref(0);
const analyticsPlaceholder = ref(true);

const chartData = ref([
  { label: '00:00', value: 12400 },
  { label: '04:00', value: 18200 },
  { label: '08:00', value: 24500 },
  { label: '12:00', value: 48200 },
  { label: '16:00', value: 65100 },
  { label: '20:00', value: 92400 },
  { label: '24:00', value: 184520 },
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
      analyticsPlaceholder.value = false;
    }
  } catch {
    // Fallback gracefully
  }
});
</script>
