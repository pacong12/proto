<script setup lang="ts">
import { type HTMLAttributes, inject, computed, type ComputedRef } from 'vue';
import { TabsTrigger as RadixTabsTrigger, type TabsTriggerProps, useForwardProps } from 'radix-vue';
import { cn } from '@/lib/utils';
import type { TabsVariant } from './TabsList.vue';

interface Props extends TabsTriggerProps {
  class?: HTMLAttributes['class'];
  variant?: TabsVariant;
}

const props = defineProps<Props>();
const forwarded = useForwardProps(props);

const parentVariant = inject<ComputedRef<TabsVariant>>(
  'tabsVariant',
  computed(() => 'default'),
);

const currentVariant = computed(() => props.variant || parentVariant.value);
</script>

<template>
  <RadixTabsTrigger
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex items-center justify-center whitespace-nowrap text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none',
        currentVariant === 'line'
          ? 'rounded-none border-b-2 border-transparent px-1 py-2.5 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold -mb-px'
          : 'rounded-md px-3 py-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:font-bold',
        props.class,
      )
    "
  >
    <slot />
  </RadixTabsTrigger>
</template>
