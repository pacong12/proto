<script setup lang="ts">
import { HoverCardRoot, type HoverCardRootProps, useForwardProps } from 'radix-vue';

const props = withDefaults(defineProps<HoverCardRootProps>(), {
  openDelay: 100,
  closeDelay: 150,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <HoverCardRoot v-bind="forwarded">
    <slot />
  </HoverCardRoot>
</template>
