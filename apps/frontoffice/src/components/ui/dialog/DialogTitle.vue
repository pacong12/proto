<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { DialogTitle as RadixDialogTitle, type DialogTitleProps, useForwardProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>();
const forwarded = useForwardProps(props);
</script>

<template>
  <RadixDialogTitle
    v-bind="forwarded"
    :class="cn('text-lg font-semibold leading-none tracking-tight text-white', props.class)"
  >
    <slot />
  </RadixDialogTitle>
</template>
