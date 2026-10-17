<template>
  <div v-if="account" class="space-y-2">
    <div class="flex items-center justify-between text-xs">
      <span class="font-bold text-foreground">{{ t('openOrders') }} ({{ orders.length }})</span>
    </div>
    <p v-if="orders.length === 0" class="text-xs text-muted-foreground">{{ t('noOpenOrders') }}</p>
    <ul v-else class="space-y-1.5">
      <li
        v-for="o in orders"
        :key="o.key"
        class="flex items-center justify-between gap-2 rounded-xl border border-border px-2.5 py-2 text-xs"
      >
        <div class="min-w-0 space-y-0.5">
          <div class="font-semibold text-foreground">
            <span :class="o.isBuy ? 'text-emerald-500' : 'text-rose-500'">{{ label(o) }}</span>
            · {{ size(o) }}
          </div>
          <div class="text-muted-foreground tabular-nums">
            {{ t('expiresIn') }} {{ remaining(o.deadline) }}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          class="h-7 text-xs"
          :disabled="busy"
          @click="cancelOrder(o)"
        >
          {{ t('cancelOrder') }}
        </Button>
      </li>
    </ul>
    <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { LimitOrderEntity, NetworkConfig } from '@goton/shared-types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useI18n } from '@/lib/i18n';
import { useLimitOrders } from '@/composables/useLimitOrders';

const props = defineProps<{
  token: `0x${string}`;
  symbol: string;
  network: NetworkConfig;
  account?: string | null;
  /** Bump to reload, e.g. after placing an order. */
  refreshKey?: number;
}>();
const { t } = useI18n();
const { busy, error, cancel, listOpen } = useLimitOrders();
const orders = ref<LimitOrderEntity[]>([]);
let timer: ReturnType<typeof setInterval> | null = null;

const quoteSymbol = () => props.network.nativeCurrency.symbol;
function label(o: LimitOrderEntity): string {
  if (o.isBuy) return t('limitBuyLabel');
  const tp = o.minOut !== '0';
  const sl = o.slPriceX36 !== '0';
  return tp && sl ? 'TP / SL' : sl ? t('stopLossLabel') : t('takeProfitLabel');
}
function size(o: LimitOrderEntity): string {
  const n = Number(BigInt(o.amount) / 10n ** 12n) / 1e6;
  return o.isBuy
    ? `${n.toLocaleString()} ${quoteSymbol()}`
    : `${n.toLocaleString()} ${props.symbol}`;
}
function remaining(deadline: number): string {
  const s = deadline - Math.floor(Date.now() / 1000);
  if (s <= 0) return '—';
  return s >= 86_400
    ? `${Math.floor(s / 86_400)}d`
    : s >= 3_600
      ? `${Math.floor(s / 3_600)}h`
      : `${Math.ceil(s / 60)}m`;
}

async function load() {
  if (!props.account) {
    orders.value = [];
    return;
  }
  orders.value = await listOpen(props.account, props.token);
}

async function cancelOrder(o: LimitOrderEntity) {
  if (await cancel(props.network, o.orderId)) {
    toast.success(t('orderCancelled'));
    orders.value = orders.value.filter((x) => x.key !== o.key);
  }
}

watch(() => [props.account, props.token, props.refreshKey], load);
onMounted(() => {
  void load();
  timer = setInterval(load, 15_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
