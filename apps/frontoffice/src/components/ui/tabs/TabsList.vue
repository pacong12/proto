<script setup lang="ts">
import { type HTMLAttributes, provide, computed, type ComputedRef } from 'vue';
import { TabsList as RadixTabsList, type TabsListProps } from 'radix-vue';
import { cn } from '@/lib/utils';

export type TabsVariant = 'default' | 'line';

interface Props extends TabsListProps {
  class?: HTMLAttributes['class'];
  variant?: TabsVariant;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
});

provide<ComputedRef<TabsVariant>>(
  'tabsVariant',
  computed(() => props.variant),
);
</script>

<template>
  <RadixTabsList
    v-bind="props"
    :class="
      cn(
        'inline-flex items-center text-muted-foreground',
        props.variant === 'line'
          ? 'w-full justify-start rounded-none border-b border-border bg-transparent p-0 gap-6'
          : 'h-9 justify-center rounded-lg bg-muted/50 p-1 border border-border gap-1',
        props.class,
      )
    "
  >
    <slot />
  </RadixTabsList>
</template>
