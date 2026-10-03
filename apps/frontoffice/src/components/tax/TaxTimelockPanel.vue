<script setup lang="ts">
import { computed } from 'vue';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-vue-next';
import { Button } from '../ui/button';
import type { PendingTaxConfig } from '../../composables/useTaxConfig';

// ---------------------------------------------------------------------------
// Props & emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  tokenAddress: `0x${string}`;
  pending: PendingTaxConfig | null;
  hasPending: boolean;
  isReady: boolean;
  secondsUntilReady: number;
  actionLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  accept: [];
  cancel: [];
}>();

// ---------------------------------------------------------------------------
// Derived display
// ---------------------------------------------------------------------------

const buyTaxPct = computed(() =>
  props.pending ? (props.pending.buyTaxBps / 100).toFixed(2) : '—',
);
const sellTaxPct = computed(() =>
  props.pending ? (props.pending.sellTaxBps / 100).toFixed(2) : '—',
);

const activatesAt = computed(() => {
  if (!props.pending) return '—';
  const ms = Number(props.pending.validAfter) * 1000;
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
});

const timelockLabel = computed(() => {
  if (props.isReady) return 'Ready to apply';
  const h = Math.floor(props.secondsUntilReady / 3600);
  const m = Math.floor((props.secondsUntilReady % 3600) / 60);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
});
</script>

<template>
  <div class="space-y-4 font-mono text-xs">
    <!-- No pending proposal -->
    <div
      v-if="!hasPending"
      class="flex items-center gap-2 text-muted-foreground py-2"
    >
      <CheckCircle class="w-4 h-4 text-emerald-500 shrink-0" />
      <span>No pending tax change. Propose a new configuration above.</span>
    </div>

    <!-- Pending proposal exists -->
    <template v-else-if="pending">
      <div class="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Pending proposal
          </span>
          <span
            class="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            :class="
              isReady
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            "
          >
            <Clock class="w-3 h-3" />
            {{ timelockLabel }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span class="text-muted-foreground">Buy tax</span>
            <p class="font-bold text-foreground">{{ buyTaxPct }}%</p>
          </div>
          <div>
            <span class="text-muted-foreground">Sell tax</span>
            <p class="font-bold text-foreground">{{ sellTaxPct }}%</p>
          </div>
          <div class="col-span-2">
            <span class="text-muted-foreground">Activates after</span>
            <p class="font-bold text-foreground">{{ activatesAt }}</p>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-2 pt-1">
          <Button
            size="sm"
            class="flex-1 text-xs h-8 gap-1.5"
            :disabled="!isReady || actionLoading"
            @click="emit('accept')"
          >
            <Loader2 v-if="actionLoading" class="w-3.5 h-3.5 animate-spin" />
            <CheckCircle v-else class="w-3.5 h-3.5" />
            Apply tax config
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="flex-1 text-xs h-8 gap-1.5"
            :disabled="actionLoading"
            @click="emit('cancel')"
          >
            <Loader2 v-if="actionLoading" class="w-3.5 h-3.5 animate-spin" />
            <XCircle v-else class="w-3.5 h-3.5" />
            Cancel proposal
          </Button>
        </div>

        <p v-if="!isReady" class="text-[10px] text-muted-foreground">
          The 24-hour timelock has not elapsed. Holders can see this pending change and exit
          before it takes effect.
        </p>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-rose-500 text-[11px]">{{ error }}</p>
    </template>
  </div>
</template>
