<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
  /** No frame: for a list that sits on the page itself rather than in a card. */
  bare?: boolean;
}>();
</script>

<template>
  <div
    :class="
      cn(
        'relative w-full overflow-auto text-foreground',
        !bare && 'rounded-2xl border border-border bg-black shadow-xs',
      )
    "
  >
    <table :class="cn('w-full caption-bottom text-sm', !bare && 'bg-black', props.class)">
      <slot />
    </table>
  </div>
</template>
