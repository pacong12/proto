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
    <div v-else class="rounded-2xl border border-border overflow-hidden bg-black">
      <Table class="text-xs font-mono bg-black">
        <TableHeader>
          <TableRow class="border-b border-border text-muted-foreground bg-black hover:bg-black">
            <TableHead class="py-2.5 px-3 font-semibold text-muted-foreground bg-black">Asset</TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">Balance</TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">Price (USD)</TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">Value (USD)</TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="pos in portfolioPositions"
            :key="pos.tokenAddress"
            class="hover:bg-zinc-900/40 transition-colors bg-black"
          >
            <TableCell class="py-2.5 px-3">
              <div class="flex items-center gap-2">
                <Avatar class="w-6 h-6 rounded border border-border overflow-hidden">
                  <AvatarFallback class="text-[9px] bg-muted text-foreground font-mono">
                    {{ pos.symbol.slice(0, 3) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-bold text-foreground">{{ pos.name }}</span>
                <span class="text-muted-foreground">${{ pos.symbol }}</span>
              </div>
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right text-foreground font-medium">
              {{ pos.balanceFormatted }}
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right text-muted-foreground">
              ${{ pos.priceUsd.toFixed(8) }}
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right text-foreground font-bold">
              ${{
                pos.valueUsd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right">
              <Button
                as-child
                variant="outline"
                size="sm"
                class="h-7 px-2.5 text-xs font-semibold gap-1 border-border cursor-pointer font-mono"
              >
                <RouterLink :to="`/token/${pos.tokenAddress}`">
                  Trade
                  <ExternalLink class="w-3 h-3" />
                </RouterLink>
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExternalLink, PieChart } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Empty } from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { PortfolioPosition } from './types';

defineProps<{
  portfolioPositions: PortfolioPosition[];
}>();
</script>
