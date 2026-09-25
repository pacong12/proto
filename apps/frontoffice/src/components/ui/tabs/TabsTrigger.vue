<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { TabsTrigger, type TabsTriggerProps, useForwardProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-muted active:scale-95 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-bold',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
