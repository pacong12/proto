<template>
  <div
    class="fixed bottom-0 left-0 right-0 z-40 p-3 bg-black/95 backdrop-blur-lg border-t border-border flex items-center justify-between gap-3 sm:hidden shadow-2xl"
  >
    <div class="flex flex-col min-w-0">
      <span class="text-[10px] text-muted-foreground font-sans">Price</span>
      <span class="text-sm font-bold text-foreground truncate">
        {{ formatPriceUsd(currentMarketData.priceUsd) }}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Button
        size="sm"
        class="h-9 px-4 font-sans font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-xs"
        @click="$emit('scrollToSwap', 'buy')"
      >
        Buy ${{ currentToken.symbol }}
      </Button>
      <Button
        size="sm"
        class="h-9 px-4 font-sans font-bold text-xs bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-xs"
        @click="$emit('scrollToSwap', 'sell')"
      >
        Sell
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { formatPriceUsd } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

interface Props {
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
}

defineProps<Props>();

defineEmits<{
  (e: 'scrollToSwap', tab: 'buy' | 'sell'): void;
}>();
</script>
