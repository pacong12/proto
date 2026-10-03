<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';
import type { PendingTaxConfig } from '../../composables/useTaxConfig';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const props = defineProps<{
  pending: PendingTaxConfig;
  /** Optional: token symbol for display, e.g. "PEPE" */
  symbol?: string;
}>();

// ---------------------------------------------------------------------------
// Derived display values
// ---------------------------------------------------------------------------

const buyTaxPct = computed(() => (props.pending.buyTaxBps / 100).toFixed(2));
const sellTaxPct = computed(() => (props.pending.sellTaxBps / 100).toFixed(2));

const activatesAt = computed(() => {
  const ms = Number(props.pending.validAfter) * 1000;
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
});

const isImminent = computed(() => {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(props.pending.validAfter) - now;
  // within 1 hour — escalate to more prominent warning
  return diff >= 0 && diff < 3600;
});

const hasActivated = computed(() => {
  return BigInt(Math.floor(Date.now() / 1000)) >= props.pending.validAfter;
});
</script>

<template>
  <div
    class="flex items-start gap-3 px-4 py-3 rounded-xl border font-mono text-xs"
    :class="
      hasActivated
        ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        : isImminent
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
          : 'bg-yellow-500/8 border-yellow-500/20 text-yellow-700 dark:text-yellow-400'
    "
    role="alert"
  >
    <AlertTriangle class="w-4 h-4 mt-0.5 shrink-0" />

    <div class="min-w-0 space-y-0.5">
      <p class="font-bold text-[11px] uppercase tracking-wide">
        {{ hasActivated ? 'Tax change ready to activate' : 'Pending tax configuration change' }}
      </p>
      <p class="text-[11px] leading-relaxed">
        <span v-if="symbol">${{ symbol }} </span>
        <span>
          Buy tax
          <strong>{{ buyTaxPct }}%</strong>, sell tax
          <strong>{{ sellTaxPct }}%</strong>
          {{ hasActivated ? 'can be applied by the deployer now.' : `will activate after ${activatesAt}.` }}
        </span>
      </p>
      <p v-if="!hasActivated" class="text-[10px] opacity-75">
        If you are holding {{ symbol ? `$${symbol}` : 'this token' }}, you have until
        {{ activatesAt }} to decide before the new tax takes effect.
      </p>
    </div>
  </div>
</template>
