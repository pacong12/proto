<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import {
  SliderRange,
  SliderRoot,
  type SliderRootEmits,
  type SliderRootProps,
  SliderThumb,
  SliderTrack,
  useForwardPropsEmits,
} from 'radix-vue';
import { cn } from '@/lib/utils';

interface Props extends SliderRootProps {
  class?: HTMLAttributes['class'];
  rangeClass?: HTMLAttributes['class'];
  thumbClass?: HTMLAttributes['class'];
}

const props = defineProps<Props>();
const emits = defineEmits<SliderRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SliderRoot
    v-bind="forwarded"
    :class="
      cn('relative flex w-full touch-none select-none items-center cursor-pointer', props.class)
    "
  >
    <SliderTrack class="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderRange :class="cn('absolute h-full bg-foreground', props.rangeClass)" />
    </SliderTrack>
    <SliderThumb
      v-for="(_, key) in props.modelValue ?? props.defaultValue ?? [0]"
      :key="key"
      :class="
        cn(
          'block h-4 w-4 rounded-full border-2 border-foreground bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-sm',
          props.thumbClass,
        )
      "
    />
  </SliderRoot>
</template>
