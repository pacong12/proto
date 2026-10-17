<template>
  <div class="p-2.5 sm:p-3 rounded-2xl bg-card border border-border shadow-2xs space-y-2">
    <!-- Header: title and window selector -->
    <div class="flex items-center justify-between gap-2 text-xs">
      <span class="font-bold text-foreground">{{ t('buySellPressure') }}</span>
      <div class="inline-flex rounded-lg bg-muted p-0.5" role="group" :aria-label="t('timeWindow')">
        <button
          v-for="w in WINDOWS"
          :key="w"
          type="button"
          class="min-w-6 min-h-6 px-2 rounded-md font-mono text-[11px] font-semibold transition cursor-pointer"
          :class="
            w === windowKey
              ? 'bg-background text-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          "
          :aria-pressed="w === windowKey"
          @click="windowKey = w"
        >
          {{ w }}
        </button>
      </div>
    </div>

    <!-- B% / S% bar, from real buy and sell volume (not votes) -->
    <div class="space-y-1">
      <div class="w-full h-2 rounded-full bg-muted/60 overflow-hidden flex">
        <template v-if="flow && flow.buyPercent !== null">
          <div
            class="h-full bg-emerald-500 transition-all duration-500"
            :style="{ width: `${flow.buyPercent}%` }"
          />
          <div
            class="h-full bg-rose-500 transition-all duration-500"
            :style="{ width: `${flow.sellPercent}%` }"
          />
        </template>
      </div>

      <p v-if="!flow || flow.buyPercent === null" class="text-[11px] text-muted-foreground">
        {{ loaded ? t('noTradesInWindow') : '…' }}
      </p>
      <template v-else>
        <div class="flex items-center justify-between text-[11px] font-mono font-bold">
          <span class="text-emerald-500">B {{ formatPercent(flow.buyPercent) }}</span>
          <span class="text-rose-500">{{ formatPercent(flow.sellPercent!) }} S</span>
        </div>
        <div
          class="flex items-center justify-between text-[11px] font-mono text-muted-foreground tabular-nums"
        >
          <span>
            {{ formatCompactUsd(flow.buyVolumeUsd) }} · {{ flow.buys }} {{ t('buys') }} ·
            {{ flow.buyers }} {{ t('buyers') }}
          </span>
          <span class="text-right">
            {{ formatCompactUsd(flow.sellVolumeUsd) }} · {{ flow.sells }} {{ t('sells') }} ·
            {{ flow.sellers }} {{ t('sellers') }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { apiFetch } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { formatCompactUsd } from '@/lib/utils';

/**
 * Buy vs sell pressure, like the B% / S% bar on a centralized exchange: the share of quote volume
 * bought vs sold in the selected window, from indexed on-chain trades. It cannot be moved without
 * trading (and paying fees), unlike the former free vote.
 */
const props = defineProps<{ tokenAddress: string }>();
const { t } = useI18n();

const WINDOWS = ['5m', '1h', '6h', '24h'] as const;
type WindowKey = (typeof WINDOWS)[number];

interface TradeFlow {
  window: WindowKey;
  buys: number;
  sells: number;
  buyers: number;
  sellers: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  buyPercent: number | null;
  sellPercent: number | null;
}

const windowKey = ref<WindowKey>('1h');
const flow = ref<TradeFlow | null>(null);
const loaded = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

function formatPercent(value: number): string {
  return `${value.toFixed(value >= 99.95 || value < 0.05 ? 0 : 1)}%`;
}

async function load(): Promise<void> {
  if (!props.tokenAddress) return;
  try {
    const res = await apiFetch<{ success: boolean; data: TradeFlow }>(
      `/api/tokens/${props.tokenAddress}/flow?window=${windowKey.value}`,
    );
    if (res?.success) flow.value = res.data;
  } catch {
    // Keep the last value on a transient error.
  } finally {
    loaded.value = true;
  }
}

watch([() => props.tokenAddress, windowKey], () => {
  flow.value = null;
  loaded.value = false;
  void load();
});

onMounted(() => {
  void load();
  timer = setInterval(load, 15_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
