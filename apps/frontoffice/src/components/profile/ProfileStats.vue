<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 font-mono">
    <!-- Stat 1: Claimable Fees -->
    <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
      <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
        <Coins class="w-4 h-4 text-foreground" />
        Claimable Fees
      </p>
      <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">
        {{ totalClaimableWeth }} {{ nativeCurrencySymbol }}
      </p>
      <p class="text-[11px] text-muted-foreground mt-1 font-sans">v1 locker fees only</p>
    </Card>

    <!-- Stat 2: Created Tokens -->
    <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
      <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
        <Rocket class="w-4 h-4 text-foreground" />
        Created Tokens
      </p>
      <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">
        {{ createdTokensCount }}
      </p>
      <p class="text-[11px] text-muted-foreground mt-1 font-sans">
        {{ isOwnProfile ? 'Deployed by your wallet' : 'Deployed by this creator' }}
      </p>
    </Card>

    <!-- Stat 3: Active Positions -->
    <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
      <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
        <PieChart class="w-4 h-4 text-foreground" />
        Active Positions
      </p>
      <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">
        {{ activePositionsCount }}
      </p>
      <p class="text-[11px] text-muted-foreground mt-1 font-sans">Tokens currently held</p>
    </Card>

    <!-- Stat 4: Total Trades -->
    <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
      <p class="text-xs uppercase font-semibold flex items-center gap-1.5 text-muted-foreground">
        <Activity class="w-4 h-4 text-foreground" />
        Total Trades
      </p>
      <p class="text-xl sm:text-2xl font-bold text-foreground mt-2">
        {{ totalTradesCount }}
      </p>
      <p class="text-[11px] text-muted-foreground mt-1 font-sans">Buys & Sells recorded</p>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Coins, Rocket, PieChart, Activity } from 'lucide-vue-next';
import { Card } from '@/components/ui/card';

defineProps<{
  totalClaimableWeth: string;
  nativeCurrencySymbol: string;
  createdTokensCount: number;
  isOwnProfile: boolean;
  activePositionsCount: number;
  totalTradesCount: number;
}>();
</script>
