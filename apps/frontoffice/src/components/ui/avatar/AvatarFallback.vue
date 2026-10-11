<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { AvatarFallback, type AvatarFallbackProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<AvatarFallbackProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <AvatarFallback
    v-bind="props"
    :class="
      cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-mono font-bold text-foreground',
        props.class,
      )
    "
  >
    <slot />
  </AvatarFallback>
</template>
