<template>
  <div class="p-4 space-y-5">
    <!-- Description -->
    <p class="text-sm leading-relaxed text-muted-foreground">
      {{ currentToken.description || `Fixed-supply launchpad token on ${activeNetwork.name}.` }}
    </p>

    <!-- Contract addresses -->
    <div class="space-y-2">
      <p class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        {{ t('contractAddresses') }}
      </p>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-muted-foreground shrink-0">{{ t('tokenCol') }}</span>
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-xs text-foreground truncate">{{ currentToken.address }}</span>
            <button
              type="button"
              aria-label="Copy token address"
              class="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              @click="$emit('copyAddress')"
            >
              <Check v-if="copied" class="w-3 h-3 text-emerald-400" />
              <Copy v-else class="w-3 h-3" />
            </button>
            <a
              :href="`${explorerUrl}/address/${currentToken.address}`"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View token on explorer"
              class="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>
        <div v-if="currentToken.poolAddress" class="flex items-center justify-between gap-3">
          <span class="text-xs text-muted-foreground shrink-0">{{ t('pool') }}</span>
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-xs text-foreground truncate">{{ currentToken.poolAddress }}</span>
            <a
              :href="`${explorerUrl}/address/${currentToken.poolAddress}`"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View pool on explorer"
              class="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Market data grid -->
    <div class="grid grid-cols-3 gap-4 pt-3 border-t border-border">
      <div>
        <p class="text-xs uppercase tracking-wider text-muted-foreground">{{ t('price') }}</p>
        <p class="text-sm font-bold mt-0.5 text-foreground">
          {{ formatPriceUsd(currentMarketData.priceUsd) }}
        </p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-muted-foreground">{{ t('mktCap') }}</p>
        <p class="text-sm font-bold mt-0.5 text-foreground">
          {{ formatCompactUsd(currentMarketData.marketCapUsd) }}
        </p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wider text-muted-foreground">{{ t('vol24h') }}</p>
        <p class="text-sm font-bold mt-0.5 text-foreground">
          {{ formatCompactUsd(currentMarketData.volume24hUsd) }}
        </p>
      </div>
    </div>

    <!-- Trading Taxes & Fees Card -->
    <div class="space-y-2.5 pt-3 border-t border-border text-xs">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Trading Taxes &amp; Fees
          </p>
          <p class="text-xs text-foreground mt-0.5">
            Buy Tax:
            <span class="font-bold"
              >{{
                (
                  (onchainTaxConfig.buyTaxBps || currentToken.taxConfig?.buyTaxBps || 0) / 100
                ).toFixed(1)
              }}%</span
            >
            - Sell Tax:
            <span class="font-bold"
              >{{
                (
                  (onchainTaxConfig.sellTaxBps || currentToken.taxConfig?.sellTaxBps || 0) / 100
                ).toFixed(1)
              }}%</span
            >
            - Protocol Fee:
            <span class="font-bold text-emerald-500">1.0%</span>
          </p>
        </div>

        <!-- Creator Manage Tax Trigger -->
        <Button
          v-if="isCreator"
          variant="outline"
          size="sm"
          class="h-7 text-xs cursor-pointer"
          @click="$emit('openTaxModal')"
        >
          Update Tax
        </Button>
      </div>
      <!-- Revenue Split Breakdown if configured -->
      <div
        v-if="currentToken.taxConfig?.revenueSplit"
        class="space-y-1.5 pt-2 border-t border-border/60"
      >
        <p class="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Tax Revenue Split Allocation
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div class="p-2 rounded-lg bg-muted/40 border border-border">
            <span class="text-muted-foreground block text-xs">{{ t('creatorShare') }}</span>
            <span class="font-bold text-foreground"
              >{{ currentToken.taxConfig.revenueSplit.creator }}%</span
            >
          </div>
          <div class="p-2 rounded-lg bg-muted/40 border border-border">
            <span class="text-muted-foreground block text-xs">{{ t('buyback') }}</span>
            <span class="font-bold text-foreground"
              >{{ currentToken.taxConfig.revenueSplit.buyback }}%</span
            >
          </div>
          <div class="p-2 rounded-lg bg-muted/40 border border-border">
            <span class="text-muted-foreground block text-xs">{{ t('holders') }}</span>
            <span class="font-bold text-foreground"
              >{{ currentToken.taxConfig.revenueSplit.holders }}%</span
            >
          </div>
          <div class="p-2 rounded-lg bg-muted/40 border border-border">
            <span class="text-muted-foreground block text-xs">{{ t('growth') }}</span>
            <span class="font-bold text-foreground"
              >{{ currentToken.taxConfig.revenueSplit.growth }}%</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Copy, Check, ExternalLink } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { formatCompactUsd, formatPriceUsd } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData, NetworkConfig } from '@goton/shared-types';

const { t } = useI18n();

interface Props {
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  activeNetwork: NetworkConfig;
  explorerUrl?: string;
  copied?: boolean;
  onchainTaxConfig: { buyTaxBps: number; sellTaxBps: number };
  isCreator: boolean;
}

withDefaults(defineProps<Props>(), {
  explorerUrl: '',
  copied: false,
});

defineEmits<{
  (e: 'copyAddress'): void;
  (e: 'openTaxModal'): void;
}>();
</script>
