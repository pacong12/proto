<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div
    :class="
      cn(
        'rounded-2xl border border-border bg-card text-card-foreground shadow-xs p-5 my-4 transition-colors',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
