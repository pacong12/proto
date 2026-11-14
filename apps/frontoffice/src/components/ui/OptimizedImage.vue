<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { Skeleton } from '@/components/ui/skeleton';

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

/** Whether the caller chose a corner radius; otherwise default to rounded-lg. */
const hasRadius = computed(() => /(^|\s)rounded(-|\s|$)/.test(props.class));

const isLoaded = ref(false);
const hasError = ref(false);
/** Still loading after SLOW_MS: stop the skeleton and show the fallback under the image. */
const isSlow = ref(false);
const gatewayIndex = ref(0);

// A missing IPFS logo can hang for a long time on every gateway without ever firing
// load or error, which would leave the skeleton sweeping forever. The image keeps
// trying underneath and covers the fallback if it does arrive.
const SLOW_MS = 4000;
let slowTimer: ReturnType<typeof setTimeout> | undefined;
function startSlowTimer() {
  clearTimeout(slowTimer);
  isSlow.value = false;
  if (!props.src) return;
  slowTimer = setTimeout(() => {
    if (!isLoaded.value) isSlow.value = true;
  }, SLOW_MS);
}
startSlowTimer();
onBeforeUnmount(() => clearTimeout(slowTimer));

const CANDIDATE_GATEWAYS = [
  (hash: string) => `/api/ipfs/${hash}`,
  (hash: string) => `https://ipfs.filebase.io/ipfs/${hash}`,
  (hash: string) => `https://4everland.io/ipfs/${hash}`,
  (hash: string) => `https://gateway.pinata.cloud/ipfs/${hash}`,
];

const resolvedSrc = computed(() => {
  if (!props.src) return '';
  // Resolve ipfs:// protocol to local API cache first, with reputable fallbacks
  if (props.src.startsWith('ipfs://')) {
    const hash = props.src.replace('ipfs://', '');
    const resolver = CANDIDATE_GATEWAYS[gatewayIndex.value] || CANDIDATE_GATEWAYS[0];
    return resolver(hash);
  }
  return props.src;
});

watch(
  () => props.src,
  () => {
    isLoaded.value = false;
    hasError.value = false;
    gatewayIndex.value = 0;
    startSlowTimer();
  },
);

function handleLoad() {
  isLoaded.value = true;
  hasError.value = false;
  isSlow.value = false;
  clearTimeout(slowTimer);
}

function handleError() {
  if (props.src.startsWith('ipfs://') && gatewayIndex.value < CANDIDATE_GATEWAYS.length - 1) {
    gatewayIndex.value++;
    return;
  }
  hasError.value = true;
  isLoaded.value = false;
  clearTimeout(slowTimer);
}
</script>

<template>
  <!-- The caller's rounded-* class sets the shape; the clipped box and skeleton inherit it. -->
  <div class="relative inline-block shrink-0" :class="[props.class, hasRadius ? '' : 'rounded-lg']">
    <div
      class="@container relative flex items-center justify-center overflow-hidden rounded-[inherit] bg-muted text-muted-foreground select-none"
      :style="{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        aspectRatio: aspectRatio,
      }"
    >
      <!-- Placeholder / Blur skeleton while loading -->
      <Skeleton
        v-if="!isLoaded && !hasError && !isSlow && resolvedSrc"
        class="absolute inset-0 rounded-[inherit]"
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
        class="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
        :class="{ 'opacity-0': !isLoaded, 'opacity-100': isLoaded }"
        @load="handleLoad"
        @error="handleError"
      />

      <!-- Fallback avatar when the image is empty, failed, or is too slow (it sits under the img) -->
      <span
        v-if="!resolvedSrc || hasError || (isSlow && !isLoaded)"
        class="font-bold uppercase leading-none text-foreground text-[min(0.75rem,28cqw)]"
      >
        {{ fallbackText ? fallbackText.slice(0, 3) : 'TOK' }}
      </span>
    </div>

    <!-- GMGN-style Sub-Badge at Bottom-Right (Chain and/or Currency Logo) -->
    <div
      v-if="chainBadge || currencyBadge"
      class="absolute -bottom-1 -right-1 flex items-center bg-card rounded-full p-0.5 shadow-xs border border-border z-10"
    >
      <img
        v-if="chainBadge"
        :src="chainBadge"
        alt="Chain"
        width="14"
        height="14"
        class="w-3.5 h-3.5 rounded-full object-contain"
      />
      <img
        v-if="currencyBadge"
        :src="currencyBadge"
        alt="Currency"
        width="14"
        height="14"
        class="w-3.5 h-3.5 rounded-full object-contain -ml-1 border-l border-border"
      />
    </div>
  </div>
</template>
