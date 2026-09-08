<template>
  <div
    :class="cn('relative rounded-full overflow-hidden shrink-0 select-none shadow-sm', props.class)"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: iconData.backgroundColor,
    }"
  >
    <svg
      viewBox="0 0 100 100"
      class="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        v-for="(shape, idx) in iconData.shapes"
        :key="idx"
        x="0"
        y="0"
        width="100"
        height="100"
        :fill="shape.fill"
        :transform="shape.transform"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';
import { generateJazzicon } from '@/lib/jazzicon';
import { cn } from '@/lib/utils';

interface Props {
  address?: string | null;
  size?: number;
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  address: '0x0000000000000000000000000000000000000000',
  size: 24,
});

const iconData = computed(() => {
  const target = props.address || '0x0000000000000000000000000000000000000000';
  return generateJazzicon(target);
});
</script>
