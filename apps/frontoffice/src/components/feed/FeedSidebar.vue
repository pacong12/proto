<template>
  <aside class="space-y-4 text-sm">
    <!-- Quick Search Pill -->
    <div class="relative w-full">
      <Search
        class="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2"
      />
      <input
        :value="searchQuery"
        type="text"
        placeholder="Search feed, cashtags..."
        class="w-full h-9 pl-9 pr-4 text-sm rounded-xl bg-card border border-border/80 focus:border-primary focus:bg-background outline-none transition text-foreground placeholder:text-muted-foreground shadow-2xs"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Hot Movers on Call Widget -->
    <div class="rounded-2xl border border-border/80 bg-card/70 p-4 space-y-3 shadow-2xs">
      <div class="flex items-center justify-between">
        <h2 class="font-bold text-sm text-foreground flex items-center gap-1.5">
          <Flame class="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span>Hot Tokens on Call</span>
        </h2>
        <span class="text-xs text-muted-foreground uppercase font-bold">Dex Movers</span>
      </div>

      <Empty
        v-if="hotTokens.length === 0"
        title="No hot movers"
        description="No trending tokens on this chain today."
        class="py-6 border-none bg-muted/20"
      >
        <template #icon>
          <Flame class="w-5 h-5 text-muted-foreground" />
        </template>
      </Empty>
      <div v-else class="space-y-2">
        <div
          v-for="(tItem, idx) in hotTokens"
          :key="tItem.token.address"
          class="flex items-center justify-between hover:bg-muted/50 p-2 rounded-xl transition cursor-pointer"
          @click="$emit('selectToken', tItem.token.address)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="text-xs font-bold text-muted-foreground w-4 text-center">
              #{{ idx + 1 }}
            </span>
            <div class="relative shrink-0">
              <OptimizedImage
                :src="tItem.token.logo"
                :alt="tItem.token.name"
                :fallback-text="tItem.token.symbol"
                :width="26"
                :height="26"
                class="rounded-full shrink-0 border border-border/60"
              />
              <img
                :src="getChainIcon(tItem.token.address)"
                :alt="getChainName(tItem.token.address)"
                :title="getChainName(tItem.token.address)"
                class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-black bg-black object-contain shadow-xs"
              />
            </div>
            <div class="min-w-0">
              <span class="font-black text-foreground text-xs block">
                ${{ tItem.token.symbol }}
              </span>
              <span class="text-xs text-muted-foreground truncate block font-sans">
                {{ tItem.token.name }}
              </span>
            </div>
          </div>

          <div class="text-right shrink-0">
            <span class="font-bold text-foreground block text-xs">
              {{ formatMarketCap(tItem.marketData?.marketCapUsd) }}
            </span>
            <span
              class="text-xs font-bold"
              :class="
                (tItem.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
              "
            >
              {{ (tItem.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
              }}{{ (tItem.marketData?.priceChange24h ?? 0).toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Search, Flame } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Empty } from '@/components/ui/empty';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import {
  getTokenChainIcon as getChainIcon,
  getTokenChainName as getChainName,
  formatMarketCap,
} from '@/lib/utils';
import { useTokenStore } from '@/composables/useTokenStore';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

interface TokenItem {
  token: LaunchedTokenEntity;
  marketData?: TokenMarketData | null;
}

interface Props {
  searchQuery: string;
  hotTokens: TokenItem[];
}

defineProps<Props>();

const { t } = useI18n();

defineEmits<{
  (e: 'update:searchQuery', val: string): void;
  (e: 'selectToken', address: string): void;
}>();
</script>
