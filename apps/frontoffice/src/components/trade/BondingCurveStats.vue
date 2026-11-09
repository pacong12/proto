<template>
  <div class="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-xs">
    <!-- Graduation Progress Bar Strip: a pool token trades in its pool from launch, with no curve. -->
    <div v-if="currentToken.version !== 'v4'" class="space-y-2.5">
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-bold text-foreground truncate">
            {{ currentToken.version === 'v2' ? t('bondingCurveProgress') : t('uniswapLiquidity') }}
          </span>
          <Badge
            :variant="currentMarketData.isGraduated ? 'default' : 'outline'"
            class="text-xs h-4 px-1.5 uppercase whitespace-nowrap shrink-0"
          >
            {{
              currentMarketData.isGraduated
                ? t('graduated')
                : `${(currentMarketData.graduationProgress * 100).toFixed(1)}% ${t('filled')}`
            }}
          </Badge>
        </div>
        <span class="text-muted-foreground text-xs whitespace-nowrap">
          {{ currentMarketData.pairedPrincipalWeth }} /
          {{ currentMarketData.graduationThresholdWeth }} {{ currencySymbol }}
        </span>
      </div>
      <Progress
        :model-value="currentMarketData.graduationProgress * 100"
        class="h-2 rounded-full"
      />
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span
          v-if="currentToken.version === 'v2' && !currentMarketData.isGraduated"
          class="flex items-center gap-1.5 text-foreground"
        >
          <span>{{ t('graduatesAt100') }}</span>
        </span>
        <span
          v-else-if="currentMarketData.isGraduated"
          class="flex items-center gap-1.5 text-emerald-500 font-semibold"
        >
          <Check class="w-3.5 h-3.5" />
          <span>{{ t('liquidityLockedDEX') }}</span>
        </span>
        <span>
          {{
            currentMarketData.isGraduated
              ? t('graduated')
              : `${t('needRemaining')} ${remainingToGraduate} ${currencySymbol}`
          }}
        </span>
      </div>
    </div>

    <!-- Post-Graduation Pool Details Card (if graduated) -->
    <div
      v-if="currentMarketData.isGraduated && currentToken.poolAddress"
      class="p-3.5 rounded-xl border border-border bg-black space-y-2 text-xs"
    >
      <div class="flex items-center justify-between font-bold text-foreground">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">{{
          t('uniswapPool')
        }}</span>
        <span class="text-emerald-500 flex items-center gap-1 text-xs">
          <Check class="w-3 h-3" />
          {{ t('locked') }}
        </span>
      </div>
      <div class="space-y-1 text-xs">
        <div class="flex justify-between">
          <span class="text-muted-foreground">{{ t('pair') }}</span>
          <div class="flex items-center gap-1">
            <span class="text-foreground">{{
              shortenAddress(currentToken.poolAddress, 6, 4)
            }}</span>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground cursor-pointer"
              title="Copy pair address"
              @click="copyPairAddress(currentToken.poolAddress)"
            >
              <Copy class="w-3 h-3" />
            </button>
            <a
              v-if="explorerUrl"
              :href="`${explorerUrl}/address/${currentToken.poolAddress}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Locked {{ currencySymbol }}</span>
          <span class="font-bold text-foreground">
            {{ currentMarketData.pairedPrincipalWeth }} {{ currencySymbol }}
          </span>
        </div>
      </div>
    </div>

    <!-- Protocol & Token Key Figures Grid -->
    <!-- Rule above only when the curve strip or pool card sits above; a pool launch starts here. -->
    <div
      class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 text-xs"
      :class="
        currentToken.version !== 'v4' || (currentMarketData.isGraduated && currentToken.poolAddress)
          ? 'pt-4 border-t border-border'
          : ''
      "
    >
      <div>
        <span class="text-muted-foreground text-xs block">{{ t('marketCap') }}</span>
        <span class="font-semibold text-foreground text-sm block mt-0.5 tabular-nums">
          {{ formatMarketCap(currentMarketData.marketCapUsd) }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs block">{{ t('price') }}</span>
        <span class="font-semibold text-foreground text-sm block mt-0.5 tabular-nums truncate">
          {{ formatPriceUsd(currentMarketData.priceUsd) }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs block">{{ t('volume24h') }}</span>
        <span class="font-semibold text-foreground text-sm block mt-0.5 tabular-nums">
          {{
            (currentMarketData.volume24hUsd ?? 0) > 0
              ? formatCompactUsd(currentMarketData.volume24hUsd)
              : '—'
          }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs block" :title="t('holdersHint')">{{
          t('holders')
        }}</span>
        <span class="font-semibold text-foreground text-sm block mt-0.5 tabular-nums">
          {{ holdersCount.toLocaleString() }}{{ holdersCountCapped ? '+' : '' }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs block" :title="t('top10SupplyHint')">{{
          t('top10Supply')
        }}</span>
        <span class="font-semibold text-foreground text-sm block mt-0.5 tabular-nums">
          {{ top10HoldingPercent > 0 ? top10HoldingPercent.toFixed(1) + '%' : '—' }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs block" :title="t('devHoldsHint')">{{
          t('devHolds')
        }}</span>
        <span
          class="font-semibold text-sm block mt-0.5 tabular-nums"
          :class="devHoldingPercent > 10 ? 'text-amber-500' : 'text-foreground'"
        >
          {{ devHoldingPercent.toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- Tax, burn and the contract as one quiet line. -->
    <p class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <span title="Buy / Sell creator trading tax">
        Tax
        <span class="font-semibold text-foreground tabular-nums">
          {{ (onchainTaxConfig.buyTaxBps / 100).toFixed(0) }}% /
          {{ (onchainTaxConfig.sellTaxBps / 100).toFixed(0) }}%
        </span>
      </span>
      <template v-if="supply">
        <span aria-hidden="true">&middot;</span>
        <span :title="supply.full">
          {{ t('totalSupply') }}
          <span class="font-semibold text-foreground tabular-nums">{{ supply.compact }}</span>
        </span>
      </template>
      <template v-if="burnedInfo.percent > 0">
        <span aria-hidden="true">&middot;</span>
        <span title="Total burned supply">
          {{ t('burned') }}
          <span class="font-semibold text-foreground tabular-nums">
            {{ burnedInfo.percent.toFixed(1) }}%
          </span>
        </span>
      </template>
      <template v-if="explorerUrl">
        <span aria-hidden="true">&middot;</span>
        <a
          :href="`${explorerUrl}/token/${currentToken.address}#code`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 hover:text-foreground transition"
          :title="t('viewContractHint')"
        >
          {{ t('viewContract') }}
          <ExternalLink class="w-3 h-3" />
        </a>
      </template>
    </p>

    <!-- Extra sections (buy / sell pressure) share this card instead of a box of their own. -->
    <div v-if="$slots.default" class="pt-4 border-t border-border">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Check, Copy, ExternalLink } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { shortenAddress, formatCompactUsd, formatPriceUsd, formatMarketCap } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

const { t } = useI18n();

interface Props {
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  currencySymbol?: string;
  explorerUrl?: string;
  holdersCount?: number;
  /** The holder list reached its limit, so the wallet count is a lower bound. */
  holdersCountCapped?: boolean;
  top10HoldingPercent?: number;
  devHoldingPercent?: number;
  onchainTaxConfig?: { buyTaxBps: number; sellTaxBps: number };
  /** Burned share and amount (raw units): 0xdEaD's balance, still inside totalSupply on-chain. */
  burnedInfo?: { percent: number; raw?: bigint };
}

const props = withDefaults(defineProps<Props>(), {
  currencySymbol: 'ETH',
  explorerUrl: '',
  holdersCount: 0,
  holdersCountCapped: false,
  top10HoldingPercent: 0,
  devHoldingPercent: 0,
  onchainTaxConfig: () => ({ buyTaxBps: 0, sellTaxBps: 0 }),
  burnedInfo: () => ({ percent: 0, raw: 0n }),
});

const emit = defineEmits<{
  (e: 'copyPair', address: string): void;
}>();

/**
 * The token's supply in whole tokens, net of burns: burning sends tokens to 0xdEaD, which leaves
 * totalSupply on-chain unchanged, so the burned amount is taken off here. Compact ("988.2M"), with
 * the minted total and the burned amount as a hint.
 */
const supply = computed(() => {
  let total: bigint;
  try {
    total = BigInt(props.currentToken.totalSupply || '0');
  } catch {
    return null;
  }
  if (total <= 0n) return null;
  const burned = props.burnedInfo.raw ?? 0n;
  const unit = 10n ** BigInt(props.currentToken.decimals ?? 18);
  const whole = (raw: bigint) => Number(raw / unit);
  const live = whole(total > burned ? total - burned : 0n);
  const full = `${whole(total).toLocaleString('en')} minted`;
  return {
    compact: new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(
      live,
    ),
    full: burned > 0n ? `${full}, ${whole(burned).toLocaleString('en')} burned` : full,
  };
});

const remainingToGraduate = computed(() => {
  const target = parseFloat(props.currentMarketData.graduationThresholdWeth) || 4.2;
  const current = parseFloat(props.currentMarketData.pairedPrincipalWeth) || 0;
  return Math.max(0, target - current).toFixed(2);
});

function copyPairAddress(addr: string) {
  emit('copyPair', addr);
}
</script>
