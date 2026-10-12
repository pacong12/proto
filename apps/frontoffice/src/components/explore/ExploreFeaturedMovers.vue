<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <div
      v-for="item in latestLaunches"
      :key="item.token.address"
      @click="$emit('selectToken', item.token.address)"
      class="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/60 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-xs hover:shadow-md"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          class="p-1 -ml-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none shrink-0"
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
        <OptimizedImage
          :src="item.token.logo"
          :alt="item.token.name"
          :fallback-text="item.token.symbol"
          :width="38"
          :height="38"
          class="rounded-full border border-border object-cover shrink-0 ring-1 ring-border group-hover:ring-primary/40 transition"
        />
        <div class="min-w-0 truncate">
          <h4
            class="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition"
          >
            {{ item.token.name }}
          </h4>
          <p class="text-[11px] font-mono font-semibold text-muted-foreground truncate">
            ${{ item.token.symbol }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[11px] font-mono font-semibold text-muted-foreground bg-black border border-border px-2 py-0.5 rounded-md"
        >
          {{ formatRelativeTime(item.token.createdAt) }}
        </span>
        <div
          class="w-7 h-7 rounded-full bg-black border border-border group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors text-muted-foreground"
        >
          <ArrowRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Star, ArrowRight } from 'lucide-vue-next';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { formatRelativeTime } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

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
</script>
