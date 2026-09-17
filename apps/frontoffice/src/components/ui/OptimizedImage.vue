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
  chainBadge?: string;
  currencyBadge?: string;
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  fallbackText: '',
  width: 36,
  height: 36,
  priority: false,
  aspectRatio: '1 / 1',
  class: '',
  chainBadge: '',
  currencyBadge: '',
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
  <div class="relative inline-block shrink-0" :class="props.class">
    <div
      class="relative flex items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 select-none"
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

    <!-- GMGN-style Sub-Badge at Bottom-Right (Chain and/or Currency Logo) -->
    <div
      v-if="chainBadge || currencyBadge"
      class="absolute -bottom-1 -right-1 flex items-center bg-white dark:bg-zinc-950 rounded-full p-0.5 shadow-xs border border-zinc-200 dark:border-zinc-800 z-10"
    >
      <img
        v-if="chainBadge"
        :src="chainBadge"
        alt="Chain"
        class="w-3.5 h-3.5 rounded-full object-contain"
      />
      <img
        v-if="currencyBadge"
        :src="currencyBadge"
        alt="Currency"
        class="w-3.5 h-3.5 rounded-full object-contain -ml-1 border-l border-zinc-200 dark:border-zinc-800"
      />
    </div>
  </div>
</template>
