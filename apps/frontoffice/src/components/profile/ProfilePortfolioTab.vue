<template>
  <div class="space-y-4 font-mono">
    <Empty
      v-if="portfolioPositions.length === 0"
      title="No active holdings"
      description="No active token holdings found for this wallet address."
      class="py-14"
    >
      <template #icon>
        <PieChart class="w-6 h-6" />
      </template>
      <template #action>
        <Button as-child size="sm" variant="outline" class="rounded-xl px-4 font-mono font-bold cursor-pointer">
          <RouterLink to="/launchpad">Explore Tokens</RouterLink>
        </Button>
      </template>
    </Empty>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-left text-xs font-mono">
        <thead>
          <tr class="border-b border-border text-muted-foreground">
            <th class="py-2.5 px-3 font-semibold">Asset</th>
            <th class="py-2.5 px-3 font-semibold text-right">Balance</th>
            <th class="py-2.5 px-3 font-semibold text-right">Price (USD)</th>
            <th class="py-2.5 px-3 font-semibold text-right">Value (USD)</th>
            <th class="py-2.5 px-3 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="pos in portfolioPositions"
            :key="pos.tokenAddress"
            class="hover:bg-muted/40 transition-colors"
          >
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-2">
                <Avatar class="w-6 h-6 rounded border border-border overflow-hidden">
                  <AvatarFallback class="text-[9px] bg-muted text-foreground font-mono">
                    {{ pos.symbol.slice(0, 3) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-bold text-foreground">{{ pos.name }}</span>
                <span class="text-muted-foreground">${{ pos.symbol }}</span>
              </div>
            </td>
            <td class="py-2.5 px-3 text-right text-foreground font-medium">
              {{ pos.balanceFormatted }}
            </td>
            <td class="py-2.5 px-3 text-right text-muted-foreground">
              ${{ pos.priceUsd.toFixed(8) }}
            </td>
            <td class="py-2.5 px-3 text-right text-foreground font-bold">
              ${{
                pos.valueUsd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}
            </td>
            <td class="py-2.5 px-3 text-right">
              <Button
                as-child
                variant="outline"
                size="sm"
                class="h-7 px-2.5 text-xs font-semibold gap-1 border-border cursor-pointer font-mono"
              >
                <RouterLink :to="`/launchpad/${pos.tokenAddress}`">
                  Trade
                  <ExternalLink class="w-3 h-3" />
                </RouterLink>
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExternalLink, PieChart } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Empty } from '@/components/ui/empty';
import type { PortfolioPosition } from './types';

defineProps<{
  portfolioPositions: PortfolioPosition[];
}>();
</script>
