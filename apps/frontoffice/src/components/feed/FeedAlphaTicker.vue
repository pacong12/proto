<template>
  <div
    v-if="hotTokens.length > 0"
    class="p-2 sm:p-2.5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md flex items-center justify-between gap-3 overflow-x-auto no-scrollbar select-none text-xs shadow-2xs"
  >
    <div
      class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-bold shrink-0 text-xs border border-primary/20"
    >
      <Flame class="w-3.5 h-3.5 fill-current" />
      <span>ALPHA RADAR</span>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <button
        v-for="(tItem, idx) in hotTokens"
        :key="tItem.token.address"
        type="button"
        class="flex items-center gap-2 px-3 py-1 rounded-xl border border-border bg-black hover:bg-zinc-950 hover:border-foreground/30 transition cursor-pointer shrink-0 text-xs group"
        @click="$emit('selectToken', tItem.token.address)"
      >
        <span class="text-xs text-muted-foreground font-bold">#{{ idx + 1 }}</span>
        <div class="relative shrink-0">
          <OptimizedImage
            :src="tItem.token.logo"
            :alt="tItem.token.name"
            :fallback-text="tItem.token.symbol"
            :width="18"
            :height="18"
            class="rounded-full shrink-0 border border-border/50"
          />
          <img
            :src="getChainIcon(tItem.token.address)"
            :alt="getChainName(tItem.token.address)"
            :title="getChainName(tItem.token.address)"
            class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-black bg-black object-contain shadow-xs"
          />
        </div>
        <span class="font-black text-foreground group-hover:text-primary transition-colors">
          ${{ tItem.token.symbol }}
        </span>
        <span class="text-muted-foreground text-xs">
          {{ formatCompactUsd(tItem.marketData?.marketCapUsd || 4200) }}
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
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Flame } from 'lucide-vue-next';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { formatCompactUsd } from '@/lib/utils';
import { useTokenStore } from '@/composables/useTokenStore';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

interface TokenItem {
  token: LaunchedTokenEntity;
  marketData?: TokenMarketData | null;
}

interface Props {
  hotTokens: TokenItem[];
}

defineProps<Props>();

defineEmits<{
  (e: 'selectToken', address: string): void;
}>();

const { getTokenNetwork } = useTokenStore();

function getChainIcon(tokenAddress: string): string {
  const net = getTokenNetwork(tokenAddress);
  return net.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg';
}

function getChainName(tokenAddress: string): string {
  const net = getTokenNetwork(tokenAddress);
  return net.name;
}
</script>
