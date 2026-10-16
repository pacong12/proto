<template>
  <div
    class="fixed bottom-0 left-0 right-0 z-40 p-3 bg-black/95 backdrop-blur-lg border-t border-border flex items-center justify-between gap-3 sm:hidden shadow-2xl"
  >
    <div class="flex flex-col min-w-0">
      <span class="text-xs text-muted-foreground font-sans">{{ t('price') }}</span>
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
        {{ t('buy') }} ${{ currentToken.symbol }}
      </Button>
      <Button
        size="sm"
        class="h-9 px-4 font-sans font-bold text-xs bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-xs"
        @click="$emit('scrollToSwap', 'sell')"
      >
        {{ t('sell') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { formatPriceUsd } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

interface Props {
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
}

defineProps<Props>();

const { t } = useI18n();

defineEmits<{
  (e: 'scrollToSwap', tab: 'buy' | 'sell'): void;
}>();
</script>
