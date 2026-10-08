<template>
  <div class="space-y-4 font-mono text-xs">
    <!-- Empty state -->
    <Empty
      v-if="userActivities.length === 0"
      title="No recent trades"
      description="Trades made with this wallet will appear here automatically with on-chain transaction hashes."
      class="py-14"
    >
      <template #icon>
        <Activity class="w-6 h-6" />
      </template>
      <template #action>
        <Button
          as-child
          size="sm"
          variant="default"
          class="h-8 px-4 font-bold text-xs cursor-pointer font-mono rounded-xl mt-2"
        >
          <RouterLink to="/launchpad">
            Explore Tokens & Trade
          </RouterLink>
        </Button>
      </template>
    </Empty>

    <!-- Activity Table -->
    <div v-else class="rounded-2xl border border-border bg-black overflow-hidden shadow-xs">
      <Table class="text-xs font-mono bg-black">
        <TableHeader>
          <TableRow class="border-b border-border/80 bg-black text-muted-foreground text-[11px] hover:bg-black">
            <TableHead class="py-3 px-4 font-semibold uppercase text-muted-foreground bg-black">Action</TableHead>
            <TableHead class="py-3 px-4 font-semibold uppercase text-muted-foreground bg-black">Token</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black">Amount ({{ nativeCurrencySymbol }})</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black">Tokens</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black">Time</TableHead>
            <TableHead class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black">Tx Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="act in userActivities"
            :key="act.txHash"
            class="hover:bg-zinc-900/40 transition-colors bg-black"
          >
            <TableCell class="py-3 px-4">
              <Badge
                :variant="act.isBuy ? 'default' : 'destructive'"
                class="text-[9px] uppercase px-2 py-0.5 font-mono font-bold"
              >
                {{ act.isBuy ? 'BUY' : 'SELL' }}
              </Badge>
            </TableCell>
            <TableCell class="py-3 px-4 text-foreground font-bold font-mono">
              ${{ act.tokenSymbol }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right text-foreground font-medium font-mono">
              {{ act.ethAmount }} {{ nativeCurrencySymbol }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right text-foreground font-mono">
              {{ act.tokenAmount }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right text-muted-foreground font-mono text-[11px]">
              {{ formatRelativeTime(act.timestamp) }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right font-mono text-xs">
              <a
                :href="`${blockExplorer}/tx/${act.txHash}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline inline-flex items-center gap-1 font-mono font-semibold"
                :title="act.txHash"
              >
                <span>{{ act.txHash.slice(0, 6) }}...{{ act.txHash.slice(-4) }}</span>
                <ExternalLink class="w-3 h-3 shrink-0" />
              </a>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, ExternalLink } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatRelativeTime } from '@/lib/utils';
import type { UserActivity } from './types';

defineProps<{
  userActivities: UserActivity[];
  nativeCurrencySymbol: string;
  blockExplorer: string;
}>();
</script>
