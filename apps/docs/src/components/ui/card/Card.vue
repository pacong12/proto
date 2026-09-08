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
        'rounded-2xl border border-zinc-800 bg-zinc-900/90 text-zinc-100 shadow-sm p-5 my-4',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
