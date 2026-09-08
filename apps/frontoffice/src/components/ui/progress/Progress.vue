<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { ProgressIndicator, ProgressRoot, type ProgressRootProps } from 'radix-vue';
import { cn } from '@/lib/utils';

interface Props extends ProgressRootProps {
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
});
</script>

<template>
  <ProgressRoot
    :class="cn('relative h-2 w-full overflow-hidden rounded-full bg-zinc-800', props.class)"
    v-bind="props"
  >
    <ProgressIndicator
      class="h-full w-full flex-1 bg-emerald-500 transition-all duration-300"
      :style="`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`"
    />
  </ProgressRoot>
</template>
