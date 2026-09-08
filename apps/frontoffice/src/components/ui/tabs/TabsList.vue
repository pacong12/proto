<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { TabsList, type TabsListProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <TabsList
    v-bind="props"
    :class="
      cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 p-1 text-zinc-400 border border-zinc-800',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
