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
    <div v-else class="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs font-mono">
          <thead>
            <tr class="border-b border-border/80 bg-muted/30 text-muted-foreground text-[11px]">
              <th class="py-3 px-4 font-semibold uppercase">Action</th>
              <th class="py-3 px-4 font-semibold uppercase">Token</th>
              <th class="py-3 px-4 font-semibold text-right uppercase">Amount ({{ nativeCurrencySymbol }})</th>
              <th class="py-3 px-4 font-semibold text-right uppercase">Tokens</th>
              <th class="py-3 px-4 font-semibold text-right uppercase">Time</th>
              <th class="py-3 px-4 font-semibold text-right uppercase">Tx Hash</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            <tr
              v-for="act in userActivities"
              :key="act.txHash"
              class="hover:bg-muted/30 transition-colors"
            >
              <td class="py-3 px-4">
                <Badge
                  :variant="act.isBuy ? 'default' : 'destructive'"
                  class="text-[9px] uppercase px-2 py-0.5 font-mono font-bold"
                >
                  {{ act.isBuy ? 'BUY' : 'SELL' }}
                </Badge>
              </td>
              <td class="py-3 px-4 text-foreground font-bold font-mono">
                ${{ act.tokenSymbol }}
              </td>
              <td class="py-3 px-4 text-right text-foreground font-medium font-mono">
                {{ act.ethAmount }} {{ nativeCurrencySymbol }}
              </td>
              <td class="py-3 px-4 text-right text-foreground font-mono">
                {{ act.tokenAmount }}
              </td>
              <td class="py-3 px-4 text-right text-muted-foreground font-mono text-[11px]">
                {{ formatRelativeTime(act.timestamp) }}
              </td>
              <td class="py-3 px-4 text-right font-mono text-xs">
                <a
                  :href="`${blockExplorer}/tx/${act.txHash}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1"
                  :title="act.txHash"
                >
                  <span>{{ act.txHash.slice(0, 6) }}...{{ act.txHash.slice(-4) }}</span>
                  <ExternalLink class="w-3 h-3 shrink-0" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, ExternalLink } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { formatRelativeTime } from '@/lib/utils';
import type { UserActivity } from './types';

defineProps<{
  userActivities: UserActivity[];
  nativeCurrencySymbol: string;
  blockExplorer: string;
}>();
</script>
