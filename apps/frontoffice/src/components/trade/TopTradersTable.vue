<template>
  <div class="space-y-0">
    <div v-if="loading && topTraders.length === 0" class="py-16 text-center text-muted-foreground">
      <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
      <span class="text-xs">{{ t('loadingTraders') }}</span>
    </div>

    <div v-else-if="topTraders.length === 0" class="py-16 text-center text-muted-foreground">
      <p class="text-xs">{{ t('noTradersData') }}</p>
    </div>

    <div v-else class="overflow-x-auto rounded-2xl border border-border bg-black">
      <Table class="w-full text-left text-xs min-w-[640px] bg-black">
        <TableHeader>
          <TableRow class="border-b border-border text-muted-foreground bg-black hover:bg-black">
            <TableHead class="py-2.5 px-3 font-semibold w-10 text-muted-foreground bg-black">
              #
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-muted-foreground bg-black">{{
              t('topTraders')
            }}</TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Bought
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Sold
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Holding
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Realized PnL
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Total PnL
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="(trader, idx) in paginatedTopTraders"
            :key="trader.address"
            class="hover:bg-zinc-900/40 transition-colors bg-black"
          >
            <TableCell class="py-2.5 px-3 text-muted-foreground font-bold">
              #{{ (currentPage - 1) * pageSize + idx + 1 }}
            </TableCell>
            <TableCell class="py-2.5 px-3">
              <div class="flex items-center gap-1.5 flex-wrap">
                <Jazzicon :address="trader.address" :size="16" class="shrink-0 rounded-full" />
                <RouterLink
                  :to="'/' + getUserIdentity(trader.address).name"
                  class="text-foreground font-medium hover:underline truncate max-w-[130px] sm:max-w-none"
                >
                  {{ getUserIdentity(trader.address).displayName }}
                </RouterLink>
                <button
                  type="button"
                  aria-label="Copy trader address"
                  class="text-muted-foreground hover:text-foreground transition cursor-pointer"
                  @click="copyAddress(trader.address, `trader-${trader.address}`)"
                >
                  <Check
                    v-if="copiedId === `trader-${trader.address}`"
                    class="w-3 h-3 text-emerald-400"
                  />
                  <Copy v-else class="w-3 h-3" />
                </button>

                <!-- GMGN-style Tag Icons -->
                <div class="flex items-center gap-1 ml-0.5">
                  <TraderTagBadge :tag="getTraderRoleTag(trader)" size="sm" />
                  <TraderTagBadge :tag="getTraderPositionTag(trader.positionStatus)" size="sm" />
                </div>
              </div>
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right">
              <span class="text-foreground font-medium">
                ${{ trader.buyVolumeUsd.toLocaleString() }}
              </span>
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right">
              <span class="text-muted-foreground font-medium">
                ${{ trader.sellVolumeUsd.toLocaleString() }}
              </span>
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right">
              <div class="space-y-0.5">
                <span class="text-foreground font-bold block">
                  ${{ Math.round(getHoldingUsd(trader)).toLocaleString() }}
                </span>
                <span class="text-xs text-muted-foreground block">
                  {{ formatTokenNumber(trader.holdingAmountTokens || '0') }}
                  {{ tokenSymbol }}
                </span>
              </div>
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right">
              <div class="space-y-0.5">
                <span
                  class="font-bold block"
                  :class="getRealizedPnl(trader).usd >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                >
                  {{ getRealizedPnl(trader).usd >= 0 ? '+' : '-' }}${{
                    Math.abs(getRealizedPnl(trader).usd).toLocaleString()
                  }}
                </span>
                <span
                  class="text-xs block"
                  :class="getRealizedPnl(trader).pct >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                >
                  {{ getRealizedPnl(trader).pct >= 0 ? '+' : ''
                  }}{{ getRealizedPnl(trader).pct.toFixed(1) }}%
                </span>
              </div>
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right">
              <div class="space-y-0.5">
                <span
                  class="font-black text-sm block"
                  :class="getTotalPnl(trader).usd >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                >
                  {{ getTotalPnl(trader).usd >= 0 ? '+' : '-' }}${{
                    Math.abs(getTotalPnl(trader).usd).toLocaleString()
                  }}
                </span>
                <span
                  class="text-xs font-bold block"
                  :class="getTotalPnl(trader).pct >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                >
                  {{ getTotalPnl(trader).pct >= 0 ? '+' : ''
                  }}{{ getTotalPnl(trader).pct.toFixed(1) }}%
                </span>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Top Traders Pagination -->
      <div
        v-if="topTraders.length > pageSize"
        class="py-3 border-t border-border flex justify-center bg-black"
      >
        <Pagination
          :total="topTraders.length"
          :items-per-page="pageSize"
          :page="currentPage"
          @update:page="currentPage = $event"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Loader2, Copy, Check } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Jazzicon } from '@/components/ui/avatar';
import { TraderTagBadge, type TraderTagType } from '@/components/ui/badge';
import { formatTokenNumber } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { calculateRealizedPnl, calculateTraderTotalPnl } from '@goton/math-sdk';

export interface TopTraderRow {
  address: string;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  totalTrades: number;
  profitUsd: number;
  isDev: boolean;
  walletTag: string;
  firstBuyTimestamp?: number;
  firstBuyPriceUsd?: number;
  avgCostUsd?: number;
  holdingAmountTokens?: string;
  positionStatus?: 'holding' | 'partial' | 'clean_all';
}

interface Props {
  topTraders: TopTraderRow[];
  loading?: boolean;
  tokenSymbol?: string;
  tokenPriceUsd?: number;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  tokenSymbol: '',
  tokenPriceUsd: 0,
});

const { t } = useI18n();

const currentPage = ref(1);
const pageSize = 10;
const copiedId = ref<string | null>(null);

function copyAddress(address: string, id: string) {
  if (typeof navigator !== 'undefined') {
    navigator.clipboard.writeText(address);
    copiedId.value = id;
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = null;
    }, 2000);
  }
}

const paginatedTopTraders = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return props.topTraders.slice(start, start + pageSize);
});

watch(
  () => props.topTraders,
  (list) => {
    const max = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage.value > max) currentPage.value = 1;
  },
);

function getHoldingUsd(trader: TopTraderRow): number {
  if (trader.positionStatus === 'clean_all') return 0;
  const tokens = parseFloat(trader.holdingAmountTokens || '0');
  const price = props.tokenPriceUsd || 0;
  return tokens * price;
}

function getRealizedPnl(trader: TopTraderRow): { usd: number; pct: number } {
  return calculateRealizedPnl({
    buyVolumeUsd: trader.buyVolumeUsd || 0,
    sellVolumeUsd: trader.sellVolumeUsd || 0,
    remainingTokens: parseFloat(trader.holdingAmountTokens || '0'),
    avgCostUsd: trader.avgCostUsd || 0,
    isCleanAll: trader.positionStatus === 'clean_all',
  });
}

function getTotalPnl(trader: TopTraderRow): { usd: number; pct: number } {
  return calculateTraderTotalPnl(
    trader.buyVolumeUsd || 0,
    trader.sellVolumeUsd || 0,
    getHoldingUsd(trader),
  );
}

function getTraderRoleTag(trader: TopTraderRow): TraderTagType {
  if (trader.isDev) return 'dev';
  if ((trader.buyVolumeUsd ?? 0) >= 2000 || trader.walletTag === 'whale') return 'whale';
  if (trader.walletTag === 'sniper') return 'sniper';
  if (trader.walletTag === 'kol') return 'kol';
  if (trader.walletTag === 'bundled') return 'bundled';
  if (trader.walletTag === 'first_buy') return 'first_buy';
  if (trader.walletTag === 'smart_degen' || trader.walletTag === 'smart_money')
    return 'smart_money';
  return 'smart_money';
}

function getTraderPositionTag(status?: string): TraderTagType {
  if (status === 'clean_all') return 'sell_all';
  if (status === 'partial') return 'sell_partial';
  return 'buy_more';
}
</script>
