<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  src?: string;
  alt: string;
  fallbackText?: string;
  width?: number | string;
  height?: number | string;
  priority?: boolean;
  aspectRatio?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  fallbackText: '',
  width: 36,
  height: 36,
  priority: false,
  aspectRatio: '1 / 1',
  class: '',
});

const isLoaded = ref(false);
const hasError = ref(false);

const resolvedSrc = computed(() => {
  if (!props.src) return '';
  // Resolve ipfs:// protocol to dedicated ipfs public gateway
  if (props.src.startsWith('ipfs://')) {
    const hash = props.src.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return props.src;
});

const isSvg = computed(() => {
  return resolvedSrc.value.endsWith('.svg') || resolvedSrc.value.includes('image/svg+xml');
});

function handleLoad() {
  isLoaded.value = true;
  hasError.value = false;
}

function handleError() {
  hasError.value = true;
  isLoaded.value = false;
}
</script>

<template>
  <div
    class="relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 select-none shrink-0"
    :class="props.class"
    :style="{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      aspectRatio: aspectRatio,
    }"
  >
    <!-- Placeholder / Blur skeleton while loading -->
    <div
      v-if="!isLoaded && !hasError && resolvedSrc"
      class="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg"
      aria-hidden="true"
    />

    <!-- Modern Image element with lazy loading & priority decoding -->
    <img
      v-if="resolvedSrc && !hasError"
      :src="resolvedSrc"
      :alt="alt"
      :loading="priority ? 'eager' : 'lazy'"
      :decoding="priority ? 'sync' : 'async'"
      :fetchpriority="priority ? 'high' : 'auto'"
      class="w-full h-full object-cover transition-opacity duration-200"
      :class="{ 'opacity-0': !isLoaded, 'opacity-100': isLoaded }"
      @load="handleLoad"
      @error="handleError"
    />

    <!-- Fallback avatar when image fails or is empty -->
    <span
      v-if="!resolvedSrc || hasError"
      class="font-mono font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
    >
      {{ fallbackText ? fallbackText.slice(0, 3) : 'TOK' }}
    </span>
  </div>
</template>
