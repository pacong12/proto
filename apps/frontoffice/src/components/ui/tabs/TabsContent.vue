<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { TabsContent, type TabsContentProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<TabsContentProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <TabsContent
    :class="
      cn(
        'mt-2 ring-offset-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
        props.class,
      )
    "
    v-bind="props"
  >
    <slot />
  </TabsContent>
</template>
