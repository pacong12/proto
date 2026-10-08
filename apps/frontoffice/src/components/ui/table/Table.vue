<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div class="relative w-full overflow-auto rounded-2xl border border-border bg-black text-foreground shadow-xs">
    <table :class="cn('w-full caption-bottom text-sm bg-black', props.class)">
      <slot />
    </table>
  </div>
</template>
