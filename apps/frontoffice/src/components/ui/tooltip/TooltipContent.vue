<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import {
  TooltipContent,
  type TooltipContentProps,
  TooltipPortal,
  useForwardProps,
} from 'radix-vue';
import { cn } from '@/lib/utils';

interface Props extends TooltipContentProps {
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  side: 'top',
  sideOffset: 6,
});

const forwarded = useForwardProps(props);
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="forwarded"
      :class="
        cn(
          'z-50 overflow-hidden rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-card-foreground shadow-xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-w-xs leading-relaxed select-none',
          props.class,
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
