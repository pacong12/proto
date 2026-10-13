<template>
  <div class="space-y-0">
    <!-- Order flow filters & stats (lunch.fun style) -->
    <div
      v-if="trades.length > 0"
      class="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:px-4 border-b border-border bg-black text-xs"
    >
      <div class="flex items-center gap-1.5">
        <button
          v-for="flt in filterOptions"
          :key="flt.key"
          type="button"
          class="px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer"
          :class="
            tradeFilter === flt.key
              ? 'bg-foreground text-background shadow-2xs'
              : 'bg-black border border-border hover:bg-zinc-900 text-muted-foreground hover:text-foreground'
          "
          @click="setFilter(flt.key)"
        >
          {{ flt.label }}
        </button>
      </div>
      <div class="text-xs font-bold">
        <span class="text-muted-foreground">Net: </span>
        <span :class="orderFlowStats.netVolumeUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'">
          {{ orderFlowStats.netVolumeUsd >= 0 ? '+' : '' }}${{
            Math.abs(orderFlowStats.netVolumeUsd).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })
          }}
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && trades.length === 0" class="py-16 text-center text-muted-foreground">
      <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
      <span class="text-xs">Loading trades...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="trades.length === 0" class="py-16 text-center text-muted-foreground">
      <p class="text-xs">No trades recorded yet.</p>
    </div>

    <!-- Filter Empty State -->
    <div v-else-if="filteredTrades.length === 0" class="py-16 text-center text-muted-foreground">
      <p class="text-xs">No trades match this filter.</p>
    </div>

    <!-- Table of Trades -->
    <div v-else class="overflow-x-auto rounded-2xl border border-border bg-black">
      <Table class="w-full text-left text-xs min-w-[620px] bg-black">
        <TableHeader>
          <TableRow class="border-b border-border text-muted-foreground bg-black hover:bg-black">
            <TableHead class="py-2.5 px-3 font-semibold text-muted-foreground bg-black"
              >Time</TableHead
            >
            <TableHead class="py-2.5 px-3 font-semibold text-muted-foreground bg-black"
              >Type</TableHead
            >
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Total (USD)
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              {{ currencySymbol }}
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Amount
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Price
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-muted-foreground bg-black">
              Trader
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Tx
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="trade in paginatedTrades"
            :key="trade.id || trade.transactionHash"
            class="hover:bg-zinc-900/40 transition-colors bg-black"
          >
            <!-- 1. Time / Age -->
            <TableCell class="py-2 px-3 whitespace-nowrap text-muted-foreground text-xs">
              {{ formatRelativeTime(trade.timestamp) }}
            </TableCell>

            <!-- 2. Type (GMGN Style BUY / SELL pill) -->
            <TableCell class="py-2 px-3 whitespace-nowrap">
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold tracking-wider border select-none"
                :class="
                  trade.isBuy
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                "
              >
                {{ trade.isBuy ? 'BUY' : 'SELL' }}
              </span>
            </TableCell>

            <!-- 3. Total (USD) -->
            <TableCell
              class="py-2 px-3 whitespace-nowrap text-right font-bold"
              :class="trade.isBuy ? 'text-emerald-400' : 'text-rose-400'"
            >
              ${{
                Math.max(0.01, getTradeVolumeUsd(trade)).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}
            </TableCell>

            <!-- 4. Native Volume (ETH / USDC) -->
            <TableCell class="py-2 px-3 whitespace-nowrap text-right text-muted-foreground">
              {{ parseFloat(trade.wethAmount || '0').toFixed(4) }}
            </TableCell>

            <!-- 5. Token Amount -->
            <TableCell class="py-2 px-3 whitespace-nowrap text-right text-foreground font-medium">
              {{ formatTokenNumber(trade.tokenAmount) }}
            </TableCell>

            <!-- 6. Price (DEX Subscript notation) -->
            <TableCell class="py-2 px-3 whitespace-nowrap text-right text-foreground">
              ${{ formatSubscriptPrice(trade.priceUsd) }}
            </TableCell>

            <!-- 7. Trader (With Jazzicon + Profile Link + GMGN Tags) -->
            <TableCell class="py-2 px-3 whitespace-nowrap">
              <div class="flex items-center gap-1.5 text-foreground">
                <Jazzicon :address="trade.trader" :size="14" class="shrink-0 rounded-full" />
                <RouterLink
                  :to="'/' + getUserIdentity(trade.trader).name"
                  class="text-foreground font-medium hover:underline truncate max-w-[120px] sm:max-w-none"
                >
                  {{ getUserIdentity(trade.trader).displayName }}
                </RouterLink>
                <TraderTagBadge
                  v-if="deployer && trade.trader.toLowerCase() === deployer.toLowerCase()"
                  tag="dev"
                  size="sm"
                />
                <TraderTagBadge
                  v-else-if="getTradeVolumeUsd(trade) >= 2000"
                  tag="whale"
                  size="sm"
                />
                <button
                  type="button"
                  aria-label="Copy trader address"
                  class="text-muted-foreground hover:text-foreground transition cursor-pointer"
                  @click="copyAddress(trade.trader, trade.id + '-trader')"
                >
                  <Check
                    v-if="copiedId === trade.id + '-trader'"
                    class="w-3 h-3 text-emerald-400"
                  />
                  <Copy v-else class="w-3 h-3" />
                </button>
              </div>
            </TableCell>

            <!-- 8. Tx -->
            <TableCell class="py-2 px-3 whitespace-nowrap text-right">
              <a
                v-if="explorerUrl"
                :href="`${explorerUrl}/tx/${trade.transactionHash}`"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View transaction on explorer"
                class="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
              >
                <ExternalLink class="w-3 h-3" />
              </a>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Trades Pagination -->
      <div
        v-if="filteredTrades.length > pageSize"
        class="py-3 border-t border-border flex justify-center bg-black"
      >
        <Pagination
          :total="filteredTrades.length"
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
import { Loader2, Copy, Check, ExternalLink } from 'lucide-vue-next';
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
import { TraderTagBadge } from '@/components/ui/badge';
import { formatRelativeTime, formatTokenNumber, formatSubscriptPrice } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import type { TradeEventEntity } from '@proto/shared-types';

export interface TradeItem {
  id?: string;
  tokenAddress?: string;
  poolAddress?: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  wethAmount: string;
  priceUsd: number;
  blockNumber?: bigint | string;
  transactionHash: string;
  timestamp: number;
}

interface Props {
  trades: TradeItem[];
  loading?: boolean;
  currencySymbol?: string;
  deployer?: string;
  quoteAssetPriceUsd?: number;
  explorerUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  currencySymbol: 'ETH',
  deployer: '',
  quoteAssetPriceUsd: 2500,
  explorerUrl: '',
});

type TradeFilterType = 'all' | 'buy' | 'sell';
const tradeFilter = ref<TradeFilterType>('all');
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

function setFilter(flt: TradeFilterType) {
  tradeFilter.value = flt;
  currentPage.value = 1;
}

const filteredTrades = computed(() => {
  if (tradeFilter.value === 'all') return props.trades;
  return props.trades.filter((t) => (tradeFilter.value === 'buy' ? t.isBuy : !t.isBuy));
});

const orderFlowStats = computed(() => {
  let buyCount = 0;
  let sellCount = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  for (const t of props.trades) {
    const isB = t.isBuy;
    const val = Number(t.wethAmount || 0);
    if (isB) {
      buyCount++;
      buyVolume += val;
    } else {
      sellCount++;
      sellVolume += val;
    }
  }

  const quoteRate = props.quoteAssetPriceUsd || 2500;
  const netVolumeUsd = (buyVolume - sellVolume) * quoteRate;

  return {
    buyCount,
    sellCount,
    netVolumeUsd,
  };
});

const filterOptions = computed(() => [
  { key: 'all' as TradeFilterType, label: `All (${props.trades.length})` },
  { key: 'buy' as TradeFilterType, label: `Buys (${orderFlowStats.value.buyCount})` },
  { key: 'sell' as TradeFilterType, label: `Sells (${orderFlowStats.value.sellCount})` },
]);

const paginatedTrades = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredTrades.value.slice(start, start + pageSize);
});

watch(filteredTrades, (list) => {
  const max = Math.max(1, Math.ceil(list.length / pageSize));
  if (currentPage.value > max) currentPage.value = 1;
});

function getTradeVolumeUsd(trade: TradeItem): number {
  const byTokens = parseFloat(trade.tokenAmount || '0') * (trade.priceUsd || 0);
  if (byTokens > 0) return byTokens;
  const ethRate = props.quoteAssetPriceUsd || 2500;
  return parseFloat(trade.wethAmount || '0') * ethRate;
}
</script>
