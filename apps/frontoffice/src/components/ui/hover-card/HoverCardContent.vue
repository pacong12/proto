<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import {
  HoverCardContent,
  type HoverCardContentProps,
  HoverCardPortal,
  useForwardProps,
} from 'radix-vue';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<HoverCardContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    sideOffset: 6,
  },
);
const forwarded = useForwardProps(props);
</script>

<template>
  <HoverCardPortal>
    <HoverCardContent
      v-bind="forwarded"
      :class="
        cn(
          'z-50 w-72 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl outline-none backdrop-blur-md animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          props.class,
        )
      "
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>
