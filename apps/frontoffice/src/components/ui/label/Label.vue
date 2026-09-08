<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Label as RadixLabel, type LabelProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <RadixLabel
    v-bind="props"
    :class="
      cn(
        'text-xs font-semibold uppercase tracking-wider text-zinc-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none',
        props.class,
      )
    "
  >
    <slot />
  </RadixLabel>
</template>
