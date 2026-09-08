<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { DropdownMenuLabel, type DropdownMenuLabelProps, useForwardProps } from 'radix-vue';
import { cn } from '@/lib/utils';

const props = defineProps<
  DropdownMenuLabelProps & { class?: HTMLAttributes['class']; inset?: boolean }
>();
const forwarded = useForwardProps(props);
</script>

<template>
  <DropdownMenuLabel
    v-bind="forwarded"
    :class="
      cn(
        'px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider',
        props.inset && 'pl-8',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuLabel>
</template>
