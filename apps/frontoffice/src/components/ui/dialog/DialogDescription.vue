<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import {
  DialogDescription as RadixDialogDescription,
  type DialogDescriptionProps,
  useForwardProps,
} from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<DialogDescriptionProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
  <RadixDialogDescription
    v-bind="forwarded"
    :class="cn('text-xs text-zinc-400 leading-relaxed', props.class)"
  >
    <slot />
  </RadixDialogDescription>
</template>
