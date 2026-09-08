<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import {
  PopoverContent as RadixPopoverContent,
  type PopoverContentEmits,
  type PopoverContentProps,
  PopoverPortal,
  useForwardPropsEmits,
} from 'radix-vue';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<PopoverContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    align: 'center',
    sideOffset: 6,
  },
);
const emits = defineEmits<PopoverContentEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <PopoverPortal>
    <RadixPopoverContent
      v-bind="forwarded"
      :class="
        cn(
          'z-50 w-72 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100 shadow-2xl outline-none backdrop-blur-md animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          props.class,
        )
      "
    >
      <slot />
    </RadixPopoverContent>
  </PopoverPortal>
</template>
