<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <div
      v-for="item in latestLaunches"
      :key="item.token.address"
      class="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/60 transition-all cursor-pointer flex items-center gap-3 group shadow-xs hover:shadow-md"
      @click="$emit('selectToken', item.token.address)"
    >
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          class="min-w-6 min-h-6 inline-flex items-center justify-center p-1 -ml-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none shrink-0"
          :class="
            isPinned(item.token.address)
              ? 'text-amber-400'
              : 'text-muted-foreground/35 hover:text-amber-400'
          "
          :title="isPinned(item.token.address) ? 'Unpin coin' : 'Pin to Watchlist'"
          @click.stop="$emit('togglePin', item.token.address)"
        >
          <Star
            class="w-3.5 h-3.5"
            :class="isPinned(item.token.address) ? 'fill-amber-400 text-amber-400' : ''"
          />
        </button>
        <div class="relative shrink-0">
          <OptimizedImage
            :src="item.token.logo"
            :alt="item.token.name"
            :fallback-text="item.token.symbol"
            :width="38"
            :height="38"
            class="rounded-lg border border-border object-cover shrink-0 ring-1 ring-border group-hover:ring-primary/40 transition"
          />
          <img
            :src="getChainIcon(tokenStore.getTokenNetwork(item.token))"
            :alt="tokenStore.getTokenNetwork(item.token).name"
            :title="tokenStore.getTokenNetwork(item.token).name"
            class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-black bg-black object-contain shadow-xs"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <h4
              class="min-w-0 font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition"
            >
              {{ item.token.name }}
            </h4>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <span class="truncate min-w-[4ch]">${{ item.token.symbol }}</span>
            <TaxTooltip
              :buy-tax-bps="item.token.taxConfig?.buyTaxBps"
              :sell-tax-bps="item.token.taxConfig?.sellTaxBps"
              custom-class="text-xs shrink-0"
            />
            <span
              v-if="(item.token.taxConfig?.revenueSplit?.holders ?? 0) > 0"
              class="text-sky-400 text-xs shrink-0 whitespace-nowrap"
            >
              &middot; {{ item.token.taxConfig?.revenueSplit?.holders }}% Divs
            </span>
            <span class="shrink-0 whitespace-nowrap">
              &middot; {{ formatRelativeTime(item.token.createdAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Star } from 'lucide-vue-next';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import TaxTooltip from '@/components/ui/TaxTooltip.vue';
import { useTokenStore } from '@/composables/useTokenStore';
import { formatRelativeTime, getChainIcon } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

interface TokenItem {
  token: LaunchedTokenEntity;
  marketData?: TokenMarketData | null;
}

interface Props {
  latestLaunches: TokenItem[];
  isPinned: (address: string) => boolean;
}

defineProps<Props>();

defineEmits<{
  (e: 'selectToken', address: string): void;
  (e: 'togglePin', address: string): void;
}>();

const tokenStore = useTokenStore();
</script>
