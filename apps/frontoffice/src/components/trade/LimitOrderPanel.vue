<template>
  <div class="space-y-3 text-sm">
    <!-- Limit: buy or sell at a target market cap -->
    <template v-if="mode === 'limit'">
      <div class="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="group">
        <button
          v-for="s in ['buy', 'sell'] as const"
          :key="s"
          type="button"
          class="min-h-8 rounded-lg text-xs font-bold transition cursor-pointer"
          :class="
            side === s
              ? s === 'buy'
                ? 'bg-emerald-500 text-white'
                : 'bg-rose-500 text-white'
              : 'text-muted-foreground'
          "
          :aria-pressed="side === s"
          @click="side = s"
        >
          {{ t(s) }}
        </button>
      </div>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">
          {{ t('amount') }} ({{ side === 'buy' ? quoteSymbol : token.symbol }})
        </span>
        <Input id="lo-amount" v-model="amountInput" inputmode="decimal" placeholder="0.0" />
      </label>

      <label class="block space-y-1">
        <span class="flex justify-between text-xs text-muted-foreground">
          <span>{{ t('targetMarketCap') }}</span>
          <span>{{ t('now') }} {{ formatMarketCap(marketCapUsd) }}</span>
        </span>
        <Input id="lo-target" v-model="targetInput" inputmode="decimal" placeholder="e.g. 20000" />
      </label>
    </template>

    <!-- TP / SL: one token deposit, either or both legs -->
    <template v-else>
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">{{ t('amountOfHoldings') }}</span>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="p in [25, 50, 75, 100]"
            :key="p"
            type="button"
            class="min-h-8 rounded-lg border text-xs font-semibold transition cursor-pointer"
            :class="
              holdingsPct === p
                ? 'border-foreground text-foreground'
                : 'border-border text-muted-foreground'
            "
            :aria-pressed="holdingsPct === p"
            @click="holdingsPct = p"
          >
            {{ p }}%
          </button>
        </div>
      </div>
      <label class="block space-y-1">
        <span class="flex justify-between text-xs text-muted-foreground">
          <span>{{ t('takeProfitAt') }}</span>
          <span>{{ t('now') }} {{ formatMarketCap(marketCapUsd) }}</span>
        </span>
        <Input id="lo-tp" v-model="tpInput" inputmode="decimal" :placeholder="t('optional')" />
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">{{ t('stopLossAt') }}</span>
        <Input id="lo-sl" v-model="slInput" inputmode="decimal" :placeholder="t('optional')" />
      </label>
      <p
        v-if="stopNote"
        class="text-xs"
        :class="stopReady ? 'text-muted-foreground' : 'text-amber-500'"
      >
        {{ stopNote }}
      </p>
    </template>

    <label v-if="selling" class="flex items-center justify-between gap-2 text-xs">
      <span class="text-muted-foreground">{{ t('orderSlippage') }}</span>
      <Input id="lo-slip" v-model="toleranceInput" inputmode="decimal" class="w-20 text-right" />
    </label>

    <label class="flex items-center justify-between gap-2 text-xs">
      <span class="text-muted-foreground">{{ t('expiresIn') }}</span>
      <select
        id="lo-expiry"
        v-model.number="expiryDays"
        class="rounded-lg border border-border bg-background px-2 py-1"
      >
        <option :value="1">1d</option>
        <option :value="7">7d</option>
        <option :value="30">30d</option>
      </select>
    </label>

    <!-- What the owner gets, after fees and tax -->
    <div class="rounded-xl bg-muted/50 p-2.5 text-xs space-y-1 tabular-nums">
      <div v-for="line in summary" :key="line.label" class="flex justify-between gap-2">
        <span class="text-muted-foreground">{{ line.label }}</span>
        <span class="font-semibold text-foreground text-right">{{ line.value }}</span>
      </div>
      <p v-if="warning" class="text-amber-500">{{ warning }}</p>
      <p class="text-muted-foreground">{{ t('escrowNote') }}</p>
    </div>

    <Button v-if="!account" class="w-full" @click="$emit('openWallet')">{{
      t('connectWallet')
    }}</Button>
    <Button v-else class="w-full" :disabled="!canSubmit || busy" @click="submit">
      {{ busy ? '…' : t('placeOrder') }}
    </Button>
    <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { parseUnits } from 'viem';
import type { LaunchedTokenEntity, NetworkConfig, TokenMarketData } from '@goton/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { useI18n } from '@/lib/i18n';
import { formatMarketCap } from '@/lib/utils';
import {
  buyMinOut,
  priceAtMarketCap,
  sellFloor,
  stopPriceX36,
  type PriceContext,
} from '@/lib/limit-orders';
import { useLimitOrders } from '@/composables/useLimitOrders';
import { useOrderMarket } from '@/composables/useOrderMarket';

const props = defineProps<{
  mode: 'limit' | 'tpsl';
  token: LaunchedTokenEntity;
  marketData: TokenMarketData;
  network: NetworkConfig;
  account?: string | null;
  userTokenBalance: bigint;
  buyTaxBps: number;
  sellTaxBps: number;
}>();
const emit = defineEmits<{ (e: 'created'): void; (e: 'openWallet'): void }>();

const { t } = useI18n();
const { busy, error, createBuy, createSell } = useLimitOrders();

const side = ref<'buy' | 'sell'>('buy');
const amountInput = ref('');
const targetInput = ref('');
const holdingsPct = ref(100);
const tpInput = ref('');
const slInput = ref('');
/** Slippage tolerance of every sell leg (TP, SL, limit sell), in percent. */
const toleranceInput = ref('3');
const expiryDays = ref(7);

const quoteSymbol = computed(() => props.network.nativeCurrency.symbol);
// Raw quote units: the pool's quote token (6-decimal USDC ERC-20 on Arc, 18-decimal wei for ETH).
const quoteDecimals = computed(() => props.network.quoteTokenDecimals);
const marketCapUsd = computed(() => props.marketData.marketCapUsd);
const ctx = computed<PriceContext>(() => ({
  priceInQuote: props.marketData.priceInWeth,
  priceUsd: props.marketData.priceUsd,
  supply: Number(BigInt(props.token.totalSupply || '0') / 10n ** 12n) / 1e6,
  quoteDecimals: quoteDecimals.value,
  tokenDecimals: props.token.decimals ?? 18,
}));

const num = (s: string) => {
  const v = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(v) && v > 0 ? v : 0;
};
const amount = computed(() => num(amountInput.value));
const target = computed(() => num(targetInput.value));
const tpTarget = computed(() => num(tpInput.value));
const slTarget = computed(() => num(slInput.value));
const toleranceBps = computed(() => Math.min(5_000, Math.round(num(toleranceInput.value) * 100)));
const { invariant, stopOracle } = useOrderMarket(
  toRef(props, 'network'),
  toRef(props, 'token'),
  toRef(props, 'marketData'),
);
const selling = computed(() =>
  props.mode === 'limit' ? side.value === 'sell' : tpTarget.value > 0 || slTarget.value > 0,
);

const sellTokens = computed(() => {
  const raw = (props.userTokenBalance * BigInt(holdingsPct.value)) / 100n;
  return { raw, whole: Number(raw / 10n ** 12n) / 1e6 };
});
const fmtTokens = (raw: bigint) => (Number(raw / 10n ** 12n) / 1e6).toLocaleString();
const fmtQuote = (raw: bigint) =>
  `${(Number(raw) / 10 ** quoteDecimals.value).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${quoteSymbol.value}`;

const plan = computed(() => {
  if (props.mode === 'limit') {
    const price = priceAtMarketCap(target.value, ctx.value);
    if (side.value === 'buy') {
      return {
        kind: 'buy' as const,
        minOut: buyMinOut(amount.value, price, props.buyTaxBps, ctx.value),
      };
    }
    const raw = amount.value > 0 ? parseUnits(String(amount.value), ctx.value.tokenDecimals) : 0n;
    const leg = sellFloor(
      amount.value,
      price,
      props.sellTaxBps,
      ctx.value,
      invariant.value,
      toleranceBps.value,
    );
    return {
      kind: 'sell' as const,
      tokens: raw,
      tpMinOut: leg.floor,
      slPriceX36: 0n,
      slMinOut: 0n,
      impact: leg.impact,
    };
  }
  const tpPrice = priceAtMarketCap(tpTarget.value, ctx.value);
  const slPrice = priceAtMarketCap(slTarget.value, ctx.value);
  const leg = (price: number) =>
    sellFloor(
      sellTokens.value.whole,
      price,
      props.sellTaxBps,
      ctx.value,
      invariant.value,
      toleranceBps.value,
    );
  const tp = tpPrice > 0 ? leg(tpPrice) : { floor: 0n, impact: 0 };
  const sl = slPrice > 0 ? leg(slPrice) : { floor: 0n, impact: 0 };
  return {
    kind: 'sell' as const,
    tokens: sellTokens.value.raw,
    tpMinOut: tp.floor,
    slPriceX36: slPrice > 0 ? stopPriceX36(slPrice, ctx.value) : 0n,
    slMinOut: sl.floor,
    impact: Math.max(tp.impact, sl.impact),
  };
});

const summary = computed(() => {
  const p = plan.value;
  if (p.kind === 'buy')
    return [{ label: t('receiveAtLeast'), value: `${fmtTokens(p.minOut)} ${props.token.symbol}` }];
  const lines = [{ label: t('selling'), value: `${fmtTokens(p.tokens)} ${props.token.symbol}` }];
  if (p.tpMinOut > 0n)
    lines.push({ label: t('takeProfitReceives'), value: `≥ ${fmtQuote(p.tpMinOut)}` });
  if (p.slMinOut > 0n)
    lines.push({ label: t('stopLossReceives'), value: `≥ ${fmtQuote(p.slMinOut)}` });
  if (p.impact >= 0.005) lines.push({ label: t('priceImpact'), value: `~${pct(p.impact)}%` });
  return lines;
});

const warning = computed(() => {
  const mc = marketCapUsd.value;
  if (!(mc > 0)) return '';
  if (props.mode === 'limit' && target.value > 0) {
    if (side.value === 'buy' && target.value >= mc) return t('limitBuyAboveMarket');
    if (side.value === 'sell' && target.value <= mc) return t('limitSellBelowMarket');
  }
  if (props.mode === 'tpsl') {
    if (tpTarget.value > 0 && tpTarget.value <= mc) return t('limitSellBelowMarket');
    if (slTarget.value > 0 && slTarget.value >= mc) return t('stopAboveMarket');
  }
  const p = plan.value;
  if (p.kind === 'sell' && p.impact > 0.1) return t('largeOrderImpact', { pct: pct(p.impact) });
  return '';
});

const pct = (share: number) => (share * 100).toFixed(share < 0.1 ? 1 : 0);

/** Whether stops can fire yet, and when they will: they trigger on a time-weighted price. */
const stopReady = computed(() => stopOracle.value?.ready !== false);
const stopNote = computed(() => {
  if (!(slTarget.value > 0)) return '';
  const o = stopOracle.value;
  const minutes = String((o?.periodSeconds ?? 600) / 60);
  if (!o || o.ready) return t('stopTwapNote', { minutes, max: String(Number(minutes) * 2) });
  if (o.readyAt === null) return t('stopNotReadyFirstTrade', { minutes });
  // Past its time, the history only rolls over on the next trade.
  if (o.readyAt <= Date.now()) return t('stopNotReadyNextTrade');
  const time = new Date(o.readyAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return t('stopNotReady', { minutes, time });
});

const canSubmit = computed(() => {
  const p = plan.value;
  if (p.kind === 'buy') return amount.value > 0 && p.minOut > 0n;
  return (
    p.tokens > 0n && p.tokens <= props.userTokenBalance && (p.tpMinOut > 0n || p.slMinOut > 0n)
  );
});

async function submit() {
  const p = plan.value;
  const deadline = Math.floor(Date.now() / 1000) + expiryDays.value * 86_400;
  // Native quote is 18 decimals on both chains (Arc native USDC included); the contract requires a
  // whole number of 6-decimal units on Arc, so round there first.
  const valueWei =
    quoteDecimals.value === 6
      ? parseUnits(amount.value.toFixed(6), 6) * 10n ** 12n
      : parseUnits(String(amount.value), 18);
  const hash =
    p.kind === 'buy'
      ? await createBuy(props.network, props.token.address, valueWei, p.minOut, deadline)
      : await createSell(
          props.network,
          props.token.address,
          p.tokens,
          p.tpMinOut,
          p.slPriceX36,
          p.slMinOut,
          deadline,
        );
  if (hash) {
    toast.success(t('orderPlaced'));
    amountInput.value = '';
    emit('created');
  }
}
</script>
