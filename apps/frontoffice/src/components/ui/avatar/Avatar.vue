<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { AvatarRoot, type AvatarRootProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<AvatarRootProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <AvatarRoot
    v-bind="props"
    :class="
      cn(
        'relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900',
        props.class,
      )
    "
  >
    <slot />
  </AvatarRoot>
</template>
