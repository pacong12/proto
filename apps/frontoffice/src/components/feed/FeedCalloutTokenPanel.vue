<template>
  <div
    class="token-panel rounded-xl border border-border bg-muted/30 hover:border-foreground/25 transition cursor-pointer"
    @click.stop="emit('navigateToToken', call.tokenAddress)"
  >
    <div class="flex items-center gap-3 p-3">
      <div class="relative shrink-0">
        <OptimizedImage
          :src="call.tokenLogo"
          :alt="call.tokenName || 'Token'"
          :fallback-text="call.tokenSymbol || 'TOK'"
          :width="40"
          :height="40"
          class="rounded-lg border border-border/70"
        />
        <img
          :src="getChainIcon(call.tokenAddress)"
          :alt="getChainName(call.tokenAddress)"
          :title="getChainName(call.tokenAddress)"
          class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card bg-card object-contain"
        />
      </div>

      <div class="min-w-0 flex-1 leading-tight">
        <div class="flex items-center gap-1">
          <span class="font-black text-sm text-foreground truncate">
            ${{ call.tokenSymbol || 'TOKEN' }}
          </span>
          <Button
            variant="ghost"
            size="icon"
            class="w-6 h-6"
            :class="pinned ? 'text-foreground' : 'text-muted-foreground/40 hover:text-foreground'"
            :title="pinned ? 'Unpin coin' : 'Pin to Watchlist'"
            @click.stop="emit('togglePin', call.tokenAddress)"
          >
            <Star class="w-3.5 h-3.5" :class="pinned ? 'fill-foreground' : ''" />
          </Button>
        </div>
        <span class="block text-xs text-muted-foreground truncate">{{ call.tokenName }}</span>
      </div>

      <!-- The caller's position and how it has done since the call. -->
      <dl v-if="position" class="grid grid-cols-2 gap-x-4 text-right shrink-0">
        <dt class="stat-label">Position</dt>
        <dt class="stat-label">Profit</dt>
        <dd class="stat-value text-foreground">{{ position.size }}</dd>
        <dd class="stat-value" :class="position.up ? 'text-emerald-400' : 'text-rose-400'">
          {{ position.profit }}
        </dd>
      </dl>
    </div>

    <div
      class="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/60 text-xs"
    >
      <div class="flex items-center gap-2 min-w-0">
        <Badge
          v-if="position?.pct"
          variant="secondary"
          class="tabular-nums"
          :class="position.up ? 'text-emerald-400' : 'text-rose-400'"
          :title="position.title"
        >
          <TrendingUp v-if="position.up" class="w-3 h-3" />
          <TrendingDown v-else class="w-3 h-3" />
          {{ position.pct }}
        </Badge>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-muted-foreground">
          MC <strong class="text-foreground">{{ formatMarketCap(call.tokenMarketCapUsd) }}</strong>
        </span>
        <Button
          size="sm"
          class="h-7 px-3 text-xs font-bold rounded-lg"
          @click.stop="emit('navigateToToken', call.tokenAddress)"
        >
          {{ t('trade') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Star, TrendingUp, TrendingDown } from 'lucide-vue-next';
import { calculateUnrealizedPnl } from '@goton/math-sdk';
import type { FeedCalloutItem } from '@goton/shared-types';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import {
  formatCompactUsd,
  formatMarketCap,
  getTokenChainIcon as getChainIcon,
  getTokenChainName as getChainName,
} from '@/lib/utils';

/** A callout's token: the caller's position and profit since the call, market cap, trade link. */
const props = defineProps<{
  call: FeedCalloutItem;
  pinned: boolean;
}>();

const emit = defineEmits<{
  (e: 'navigateToToken', address: string): void;
  (e: 'togglePin', address: string): void;
}>();

const { t } = useI18n();

const signed = (v: number, text: string) => `${v >= 0 ? '+' : '-'}${text}`;

const position = computed(() => {
  const c = props.call;
  const entry = c.priceAtPost ?? 0;
  const now = c.tokenPriceUsd ?? 0;
  const size = c.positionUsd && c.positionUsd > 0 ? c.positionUsd : 0;
  if (entry > 0 && now > 0) {
    const { pnlPct, pnlUsd } = calculateUnrealizedPnl(entry, now, size || undefined);
    return {
      size: size ? formatCompactUsd(size) : '—',
      profit: pnlUsd !== null ? signed(pnlUsd, formatCompactUsd(Math.abs(pnlUsd))) : '—',
      pct: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`,
      up: pnlPct >= 0,
      title: `Entry $${entry.toPrecision(4)} → now $${now.toPrecision(4)}`,
    };
  }
  if (!size && c.profitUsd === undefined) return null;
  const profit = c.profitUsd ?? 0;
  return {
    size: size ? formatCompactUsd(size) : '—',
    profit: c.profitUsd === undefined ? '—' : signed(profit, formatCompactUsd(Math.abs(profit))),
    pct: '',
    up: profit >= 0,
    title: '',
  };
});
</script>

<style scoped>
.stat-label {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
