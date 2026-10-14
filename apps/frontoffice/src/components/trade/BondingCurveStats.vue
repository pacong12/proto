<template>
  <div class="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-xs">
    <!-- Graduation Progress Bar Strip -->
    <div class="space-y-2.5">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="font-bold text-foreground">
            {{ currentToken.version === 'v2' ? t('bondingCurveProgress') : t('uniswapLiquidity') }}
          </span>
          <Badge
            :variant="currentMarketData.isGraduated ? 'default' : 'outline'"
            class="text-xs h-4 px-1.5 uppercase"
          >
            {{
              currentMarketData.isGraduated
                ? t('graduated')
                : `${(currentMarketData.graduationProgress * 100).toFixed(1)}% ${t('filled')}`
            }}
          </Badge>
        </div>
        <span class="text-muted-foreground text-xs">
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
          <Sparkles class="w-3.5 h-3.5 text-primary" />
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
    <div
      class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-4 border-t border-border text-xs"
    >
      <div>
        <span class="text-muted-foreground text-xs uppercase font-semibold block">{{
          t('marketCap')
        }}</span>
        <span class="font-black text-foreground text-sm block mt-0.5">
          ${{ formatNumberCap(currentMarketData.marketCapUsd ?? 4200) }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs uppercase font-semibold block">{{
          t('price')
        }}</span>
        <span class="font-black text-foreground text-sm block mt-0.5 truncate">
          {{ formatPriceUsd(currentMarketData.priceUsd) }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs uppercase font-semibold block">{{
          t('volume24h')
        }}</span>
        <span class="font-black text-foreground text-sm block mt-0.5">
          {{
            (currentMarketData.volume24hUsd ?? 0) > 0
              ? formatCompactUsd(currentMarketData.volume24hUsd)
              : '—'
          }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs uppercase font-semibold block">{{
          t('holders')
        }}</span>
        <span class="font-black text-foreground text-sm block mt-0.5">
          {{ holdersCount.toLocaleString() }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs uppercase font-semibold block">{{
          t('top10Supply')
        }}</span>
        <span class="font-black text-foreground text-sm block mt-0.5">
          {{ top10HoldingPercent > 0 ? top10HoldingPercent.toFixed(1) + '%' : '—' }}
        </span>
      </div>
      <div>
        <span class="text-muted-foreground text-xs uppercase font-semibold block">{{
          t('devHolds')
        }}</span>
        <span
          class="font-black text-sm block mt-0.5"
          :class="devHoldingPercent > 10 ? 'text-amber-500' : 'text-foreground'"
        >
          {{ devHoldingPercent.toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- Trust & Secondary Badges -->
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 text-xs">
      <div
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black border border-border shrink-0"
        title="Buy / Sell creator trading tax"
      >
        <span class="text-muted-foreground font-semibold">Tax:</span>
        <span class="font-bold text-foreground">
          {{ (onchainTaxConfig.buyTaxBps / 100).toFixed(0) }}% /
          {{ (onchainTaxConfig.sellTaxBps / 100).toFixed(0) }}%
        </span>
      </div>

      <div
        v-if="burnedInfo.percent > 0"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black border border-border shrink-0"
        title="Total burned supply"
      >
        <span class="text-muted-foreground font-semibold">{{ t('burned') }}:</span>
        <span class="font-bold text-rose-500">{{ burnedInfo.percent.toFixed(1) }}%</span>
      </div>

      <a
        v-if="explorerUrl"
        :href="`${explorerUrl}/token/${currentToken.address}#code`"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold transition"
        title="View contract source on explorer"
      >
        <Check class="w-3.5 h-3.5" />
        <span>{{ t('verifiedContract') }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles, Check, Copy, ExternalLink } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { shortenAddress, formatCompactUsd, formatPriceUsd } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

const { t } = useI18n();

interface Props {
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  currencySymbol?: string;
  explorerUrl?: string;
  holdersCount?: number;
  top10HoldingPercent?: number;
  devHoldingPercent?: number;
  onchainTaxConfig?: { buyTaxBps: number; sellTaxBps: number };
  burnedInfo?: { percent: number };
}

const props = withDefaults(defineProps<Props>(), {
  currencySymbol: 'ETH',
  explorerUrl: '',
  holdersCount: 0,
  top10HoldingPercent: 0,
  devHoldingPercent: 0,
  onchainTaxConfig: () => ({ buyTaxBps: 0, sellTaxBps: 0 }),
  burnedInfo: () => ({ percent: 0 }),
});

const emit = defineEmits<{
  (e: 'copyPair', address: string): void;
}>();

const remainingToGraduate = computed(() => {
  const target = parseFloat(props.currentMarketData.graduationThresholdWeth) || 4.2;
  const current = parseFloat(props.currentMarketData.pairedPrincipalWeth) || 0;
  return Math.max(0, target - current).toFixed(2);
});

function copyPairAddress(addr: string) {
  emit('copyPair', addr);
}

function formatNumberCap(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}
</script>
