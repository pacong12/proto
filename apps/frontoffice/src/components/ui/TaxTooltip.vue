<template>
  <TooltipProvider :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          class="cursor-help transition-colors select-none inline-flex items-center"
          :class="[
            isZeroTax
              ? 'text-muted-foreground/60 hover:text-muted-foreground'
              : 'text-foreground font-semibold hover:text-primary',
            customClass || 'text-xs',
          ]"
        >
          {{ buyTaxDisplay }}%/{{ sellTaxDisplay }}%
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        class="text-xs p-2.5 space-y-1 bg-popover border border-border shadow-md"
      >
        <p class="font-bold text-foreground">Trading Taxes</p>
        <p class="text-muted-foreground">
          Buy Tax: <span class="text-emerald-400 font-semibold">{{ buyTaxDisplay }}%</span>
        </p>
        <p class="text-muted-foreground">
          Sell Tax: <span class="text-rose-400 font-semibold">{{ sellTaxDisplay }}%</span>
        </p>
        <p v-if="isZeroTax" class="text-xs text-emerald-500 pt-0.5 border-t border-border/50">
          Zero tax fair launch
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface Props {
  buyTaxBps?: number | null;
  sellTaxBps?: number | null;
  customClass?: string;
}

const props = defineProps<Props>();

const buyTaxDisplay = computed(() => {
  const val = (props.buyTaxBps ?? 0) / 100;
  return Number.isInteger(val) ? val.toFixed(0) : val.toFixed(1);
});

const sellTaxDisplay = computed(() => {
  const val = (props.sellTaxBps ?? 0) / 100;
  return Number.isInteger(val) ? val.toFixed(0) : val.toFixed(1);
});

const isZeroTax = computed(() => (props.buyTaxBps ?? 0) === 0 && (props.sellTaxBps ?? 0) === 0);
</script>
