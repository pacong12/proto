<template>
  <div v-if="account" class="space-y-2">
    <div class="flex items-center gap-1 text-xs" role="tablist">
      <button
        v-for="v in ['open', 'history'] as const"
        :key="v"
        type="button"
        role="tab"
        :aria-selected="view === v"
        class="px-2 py-1 rounded-lg font-bold transition cursor-pointer"
        :class="view === v ? 'bg-muted text-foreground' : 'text-muted-foreground'"
        @click="view = v"
      >
        {{ v === 'open' ? t('openOrders') : t('orderHistory') }}
        <span class="tabular-nums">({{ v === 'open' ? openOrders.length : history.length }})</span>
      </button>
    </div>

    <!-- Open -->
    <template v-if="view === 'open'">
      <p v-if="openOrders.length === 0" class="text-xs text-muted-foreground">
        {{ t('noOpenOrders') }}
      </p>
      <ul v-else class="space-y-1.5">
        <li
          v-for="o in openOrders"
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
    </template>

    <!-- History: filled and cancelled -->
    <template v-else>
      <p v-if="history.length === 0" class="text-xs text-muted-foreground">
        {{ t('noOrderHistory') }}
      </p>
      <ul v-else class="space-y-1.5">
        <li
          v-for="o in history"
          :key="o.key"
          class="flex items-center justify-between gap-2 rounded-xl border border-border px-2.5 py-2 text-xs"
        >
          <div class="min-w-0 space-y-0.5">
            <div class="font-semibold text-foreground">
              <span :class="o.isBuy ? 'text-emerald-500' : 'text-rose-500'">{{ label(o) }}</span>
              · {{ size(o) }}
            </div>
            <div class="text-muted-foreground tabular-nums">
              <template v-if="o.status === 'filled'">
                {{ t('orderReceived') }} {{ orderPayout(o, symbol, network) }}
              </template>
              <template v-else>{{ t('orderCancelledLabel') }}</template>
              · {{ when(o.updatedAt) }}
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="px-1.5 py-0.5 rounded-md border text-[11px] font-bold"
              :class="
                o.status === 'filled'
                  ? 'border-emerald-500/30 text-emerald-500'
                  : 'border-border text-muted-foreground'
              "
            >
              {{ o.status === 'filled' ? filledLabel(o) : t('orderCancelledLabel') }}
            </span>
            <a
              v-if="o.closedTx"
              :href="`${network.blockExplorer}/tx/${o.closedTx}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-muted-foreground hover:text-foreground"
              :aria-label="t('viewTransaction')"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>
        </li>
      </ul>
    </template>
    <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ExternalLink } from 'lucide-vue-next';
import type { LimitOrderEntity, NetworkConfig } from '@goton/shared-types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useI18n } from '@/lib/i18n';
import { orderPayout } from '@/lib/limit-orders';
import { formatRelativeTime } from '@/lib/utils';
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
const { busy, error, cancel, listByOwner } = useLimitOrders();
const orders = ref<LimitOrderEntity[]>([]);
const view = ref<'open' | 'history'>('open');
let timer: ReturnType<typeof setInterval> | null = null;

const openOrders = computed(() => orders.value.filter((o) => o.status === 'open'));
const history = computed(() => orders.value.filter((o) => o.status !== 'open'));

const quoteSymbol = () => props.network.nativeCurrency.symbol;
function label(o: LimitOrderEntity): string {
  if (o.isBuy) return t('limitBuyLabel');
  const tp = o.minOut !== '0';
  const sl = o.slPriceX36 !== '0';
  return tp && sl ? 'TP / SL' : sl ? t('stopLossLabel') : t('takeProfitLabel');
}
function filledLabel(o: LimitOrderEntity): string {
  if (o.filledLeg === 'stopLoss') return t('stopLossLabel');
  if (o.filledLeg === 'takeProfit') return t('takeProfitLabel');
  return t('orderFilledLabel');
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
function when(ms: number): string {
  return formatRelativeTime(ms);
}

async function load() {
  if (!props.account) {
    orders.value = [];
    return;
  }
  orders.value = await listByOwner(props.account, props.token);
}

async function cancelOrder(o: LimitOrderEntity) {
  if (await cancel(props.network, o.orderId)) {
    toast.success(t('orderCancelled'));
    orders.value = orders.value.map((x) =>
      x.key === o.key ? { ...x, status: 'cancelled', updatedAt: Date.now() } : x,
    );
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
