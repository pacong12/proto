<template>
  <div class="space-y-4 text-xs">
    <!-- Empty state -->
    <Empty
      v-if="userActivities.length === 0"
      :title="t('noRecentTrades')"
      :description="t('noTradesActivityDesc')"
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
          class="h-8 px-4 font-bold text-xs cursor-pointer rounded-xl mt-2"
        >
          <RouterLink to="/launchpad"> {{ t('exploreAndTrade') }} </RouterLink>
        </Button>
      </template>
    </Empty>
    <!-- Activity Table -->
    <div v-else class="rounded-2xl border border-border bg-black overflow-hidden shadow-xs">
      <Table class="text-xs bg-black">
        <TableHeader>
          <TableRow
            class="border-b border-border/80 bg-black text-muted-foreground text-xs hover:bg-black"
          >
            <TableHead class="py-3 px-4 font-semibold uppercase text-muted-foreground bg-black">{{
              t('action')
            }}</TableHead>
            <TableHead class="py-3 px-4 font-semibold uppercase text-muted-foreground bg-black">{{
              t('token')
            }}</TableHead>
            <TableHead
              class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black"
              >{{ t('amount') }} ({{ nativeCurrencySymbol }})</TableHead
            >
            <TableHead
              class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black"
              >{{ t('tokens') }}</TableHead
            >
            <TableHead
              class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black"
              >{{ t('time') }}</TableHead
            >
            <TableHead
              class="py-3 px-4 font-semibold text-right uppercase text-muted-foreground bg-black"
              >{{ t('txHash') }}</TableHead
            >
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
                class="text-xs uppercase px-2 py-0.5 font-bold"
              >
                {{ act.isBuy ? t('buy').toUpperCase() : t('sell').toUpperCase() }}
              </Badge>
            </TableCell>
            <TableCell class="py-3 px-4 text-foreground font-bold">
              ${{ act.tokenSymbol }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right text-foreground font-medium">
              {{ act.ethAmount }} {{ nativeCurrencySymbol }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right text-foreground">
              {{ act.tokenAmount }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right text-muted-foreground text-xs">
              {{ formatRelativeTime(act.timestamp) }}
            </TableCell>
            <TableCell class="py-3 px-4 text-right text-xs">
              <a
                :href="`${blockExplorer}/tx/${act.txHash}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline inline-flex items-center gap-1 font-semibold"
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
import { useI18n } from '@/lib/i18n';
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

const { t } = useI18n();

defineProps<{
  userActivities: UserActivity[];
  nativeCurrencySymbol: string;
  blockExplorer: string;
}>();
</script>
