<template>
  <div
    id="swap-panel-container"
    class="xl:col-start-2 xl:row-start-1 xl:row-span-3 w-full shrink-0 xl:sticky xl:top-20 space-y-4"
  >
    <!-- User Position Card (Displayed when user holds tokens) -->
    <div
      v-if="isConnected && userHoldingTokensCount > 0"
      class="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between text-xs font-sans shadow-xs"
    >
      <div class="space-y-0.5">
        <span class="text-muted-foreground text-[11px] block">Your Holdings</span>
        <span class="font-bold text-foreground text-sm">
          {{ formatTokenBalance(userTokenBalance) }} ${{ currentToken.symbol }}
        </span>
      </div>
      <div class="text-right space-y-0.5">
        <span class="text-muted-foreground text-[11px] block">Current Value</span>
        <span class="font-bold text-emerald-500 text-sm">
          ${{ formatCompactUsd(userHoldingUsd) }}
        </span>
      </div>
    </div>

    <div class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      <!-- Swap panel form wrapper -->
      <div class="p-5 sm:p-6 space-y-4">
        <!-- Wrong network warning banner -->
        <div
          v-if="isConnected && activeNetwork.chainId !== tokenNetwork.chainId"
          class="px-3 py-2.5 rounded-xl bg-black border border-border text-xs text-foreground flex items-center gap-2"
        >
          <AlertCircle class="w-3.5 h-3.5 shrink-0" />
          <span>Switch to {{ tokenNetwork.name }} to trade.</span>
        </div>

        <!-- Buy / Sell tabs + Slippage gear in ONE row (Semantic Colors) -->
        <div class="flex items-center justify-between gap-3">
          <div class="inline-flex rounded-xl border border-border bg-black p-1 w-full gap-1">
            <Button
              size="sm"
              class="flex-1 h-8 text-xs font-sans font-bold rounded-lg transition-all"
              :class="
                isBuy
                  ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
                  : 'text-muted-foreground hover:text-foreground bg-transparent'
              "
              @click="$emit('update:tradeTab', 'buy')"
            >
              {{ t('buy') }}
            </Button>
            <Button
              size="sm"
              class="flex-1 h-8 text-xs font-sans font-bold rounded-lg transition-all"
              :class="
                !isBuy
                  ? 'bg-rose-500 text-white shadow-sm hover:bg-rose-600'
                  : 'text-muted-foreground hover:text-foreground bg-transparent'
              "
              @click="$emit('update:tradeTab', 'sell')"
            >
              {{ t('sell') }}
            </Button>
          </div>

          <!-- Slippage Popover -->
          <Popover>
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex items-center justify-center w-8 h-8 rounded-xl border border-border bg-black text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
                :class="
                  slippage > slippageWarnThreshold ? 'text-amber-500 border-amber-500/40' : ''
                "
                title="Slippage settings"
              >
                <Settings class="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              class="w-64 p-3.5 bg-black border border-border text-foreground rounded-2xl shadow-xl text-xs"
              align="end"
            >
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs">Slippage Tolerance</span>
                  <span
                    class="text-[11px]"
                    :class="slippage > slippageWarnThreshold ? 'text-amber-500' : 'text-foreground'"
                  >
                    {{ slippage }}%
                  </span>
                </div>

                <div class="flex gap-1.5">
                  <button
                    v-for="preset in [0.5, 1.0, 2.5, 5.0]"
                    :key="preset"
                    type="button"
                    class="flex-1 py-1 rounded-lg border text-xs font-medium transition cursor-pointer"
                    :class="
                      !isCustomSlippage && slippage === preset
                        ? 'bg-foreground text-background font-bold border-foreground shadow-2xs'
                        : 'border-border bg-black text-muted-foreground hover:text-foreground hover:bg-zinc-900'
                    "
                    @click="selectSlippage(preset)"
                  >
                    {{ preset }}%
                  </button>
                </div>

                <div class="flex items-center gap-2 pt-1">
                  <div class="relative flex-1">
                    <Input
                      :model-value="customSlippageInput"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="49"
                      placeholder="Custom %"
                      class="h-7 text-xs pr-6 bg-black border-input"
                      @update:model-value="$emit('update:customSlippageInput', String($event))"
                    />
                    <span
                      class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground"
                    >
                      %
                    </span>
                  </div>
                  <button
                    type="button"
                    class="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                    @click="selectSlippage(1.0)"
                  >
                    Auto
                  </button>
                </div>

                <div
                  v-if="slippage > slippageWarnThreshold"
                  class="flex items-start gap-1.5 text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl"
                >
                  <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>High slippage increase risk of sandwich attacks.</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <!-- You Pay input -->
        <div class="space-y-2">
          <div class="flex justify-between items-center text-xs text-muted-foreground font-sans">
            <div class="flex items-center gap-2">
              <span>You pay</span>
              <div
                v-if="isBuy"
                class="flex items-center bg-black p-0.5 rounded-lg border border-border text-[10px] font-bold"
              >
                <button
                  type="button"
                  class="px-1.5 py-0.5 rounded transition cursor-pointer"
                  :class="
                    !payInUsd
                      ? 'bg-card text-foreground shadow-2xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="$emit('update:payInUsd', false)"
                >
                  {{ currencySymbol }}
                </button>
                <button
                  type="button"
                  class="px-1.5 py-0.5 rounded transition cursor-pointer"
                  :class="
                    payInUsd
                      ? 'bg-card text-foreground shadow-2xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="$emit('update:payInUsd', true)"
                >
                  USD
                </button>
              </div>
            </div>
            <div class="flex items-center gap-1.5 text-[11px]">
              <span class="text-muted-foreground">Bal:</span>
              <span
                v-if="!isBuy && isTokenBalanceLoading"
                class="animate-pulse font-bold text-foreground"
              >
                ...
              </span>
              <span v-else class="font-bold text-foreground">
                {{ isBuy ? formatEthBalance(balanceWei) : formatTokenBalance(userTokenBalance) }}
              </span>
              <span class="text-muted-foreground">
                {{ isBuy ? currencySymbol : currentToken.symbol }}
              </span>
              <Button
                variant="ghost"
                size="sm"
                class="h-5 px-1 text-[10px] font-bold text-primary hover:text-primary/80 uppercase"
                @click="$emit('applyPercentage', 100)"
              >
                MAX
              </Button>
            </div>
          </div>
          <div class="relative">
            <Input
              :model-value="amountIn"
              type="number"
              step="any"
              placeholder="0.0"
              class="text-sm sm:text-base font-semibold text-foreground bg-black border-input h-11 pr-20 rounded-xl"
              @update:model-value="$emit('update:amountIn', String($event))"
            />
            <div
              class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-black px-2 py-1 rounded-lg border border-border"
            >
              <span class="text-xs font-bold text-foreground">
                {{ isBuy ? (payInUsd ? 'USD' : currencySymbol) : currentToken.symbol }}
              </span>
            </div>
          </div>

          <!-- Buy Mode: Preset nominals only -->
          <div v-if="isBuy" class="grid grid-cols-4 gap-1.5 pt-0.5">
            <Button
              v-for="presetVal in activeBuyPresets"
              :key="presetVal"
              variant="outline"
              size="sm"
              class="h-8 text-xs font-medium rounded-lg border-border bg-black hover:bg-zinc-900"
              @click="$emit('applyQuickBuy', String(presetVal))"
            >
              {{ payInUsd ? '$' + presetVal : presetVal }}
            </Button>
          </div>

          <!-- Sell Mode: Percentage buttons only -->
          <div v-else class="grid grid-cols-4 gap-1.5 pt-0.5">
            <Button
              v-for="percent in [25, 50, 75, 100]"
              :key="percent"
              variant="outline"
              size="sm"
              class="h-8 text-xs font-medium rounded-lg border-border bg-black hover:bg-zinc-900"
              @click="$emit('applyPercentage', percent)"
            >
              {{ percent === 100 ? 'Max' : `${percent}%` }}
            </Button>
          </div>
        </div>

        <!-- You receive output -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-center text-xs text-muted-foreground font-sans">
            <span>You receive (est.)</span>
          </div>
          <div
            class="w-full rounded-xl border border-border bg-black px-3 py-2 min-h-[44px] flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-2 min-w-0">
              <OptimizedImage
                v-if="isBuy"
                :src="currentToken.logo"
                :alt="currentToken.name"
                :fallback-text="currentToken.symbol"
                :width="24"
                :height="24"
                class="rounded-full border border-border object-cover shrink-0 w-6 h-6"
              />
              <div
                v-else
                class="w-6 h-6 rounded-full bg-black flex items-center justify-center text-[9px] font-bold border border-border shrink-0"
              >
                {{ currencySymbol.slice(0, 3) }}
              </div>
              <span class="text-sm sm:text-base font-semibold text-foreground truncate">
                {{ estimatedOutputAmount }}
              </span>
            </div>
            <div
              class="flex items-center gap-1 bg-black px-2 py-0.5 rounded-lg border border-border shrink-0"
            >
              <span class="text-xs text-foreground font-bold">
                {{ isBuy ? currentToken.symbol : currencySymbol }}
              </span>
            </div>
          </div>
        </div>

        <!-- Transaction Summary Strip -->
        <div class="pt-2 border-t border-border/60 space-y-1.5 text-xs font-sans">
          <div class="flex items-center justify-between text-muted-foreground">
            <span>Price Impact</span>
            <span class="font-medium text-foreground">&lt; 0.1%</span>
          </div>
          <div class="flex items-center justify-between text-muted-foreground">
            <span>Slippage Tolerance</span>
            <span
              class="font-semibold"
              :class="slippage > slippageWarnThreshold ? 'text-amber-500' : 'text-foreground'"
            >
              {{ slippage }}%
            </span>
          </div>
          <div
            v-if="onchainTaxConfig.buyTaxBps > 0 || onchainTaxConfig.sellTaxBps > 0"
            class="flex items-center justify-between text-muted-foreground"
          >
            <span>Trading Tax</span>
            <span class="font-medium text-foreground">
              {{ isBuy ? onchainTaxConfig.buyTaxBps / 100 : onchainTaxConfig.sellTaxBps / 100 }}%
            </span>
          </div>
        </div>

        <!-- High-slippage inline warning -->
        <div
          v-if="
            slippage > slippageWarnThreshold &&
            isConnected &&
            activeNetwork.chainId !== tokenNetwork.chainId
          "
          class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-500"
        >
          <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Slippage is set to <strong>{{ slippage }}%</strong> — high sandwich attack risk. Lower
            it in the settings above or proceed with caution.
          </span>
        </div>

        <!-- CTA Swap button with Semantic Colors -->
        <Button
          v-if="!isConnected"
          class="w-full font-sans font-bold h-12 cursor-pointer rounded-xl text-sm shadow-md"
          @click="$emit('openWallet')"
        >
          {{ t('connectWallet') }}
        </Button>
        <Button
          v-else-if="activeNetwork.chainId !== tokenNetwork.chainId"
          variant="outline"
          class="w-full font-sans font-bold h-12 cursor-pointer rounded-xl text-sm border-amber-500 text-amber-500"
          @click="$emit('switchNetwork')"
        >
          Switch to {{ tokenNetwork.name }}
        </Button>
        <Button
          v-else
          :disabled="isSwapDisabled"
          class="w-full font-sans font-bold h-12 cursor-pointer rounded-xl text-sm transition shadow-md"
          :class="
            isBuy
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
          "
          @click="$emit('executeSwap')"
        >
          <Loader2 v-if="isSwapping" class="w-4 h-4 mr-2 animate-spin" />
          <ArrowUpDown v-else class="w-4 h-4 mr-2" />
          {{ swapButtonText }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, Settings, ArrowUpDown, Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { useI18n } from '@/lib/i18n';
import { formatCompactUsd } from '@/lib/utils';
import type { LaunchedTokenEntity, NetworkConfig } from '@proto/shared-types';

interface Props {
  currentToken: LaunchedTokenEntity;
  currencySymbol?: string;
  tokenNetwork: NetworkConfig;
  activeNetwork: NetworkConfig;
  isConnected: boolean;
  isBuy: boolean;
  userHoldingTokensCount: number;
  userTokenBalance: bigint;
  userHoldingUsd: number;
  balanceWei: bigint;
  amountIn: string;
  payInUsd: boolean;
  isTokenBalanceLoading: boolean;
  activeBuyPresets: (string | number)[];
  estimatedOutputAmount: string;
  slippage: number;
  isCustomSlippage: boolean;
  customSlippageInput: string;
  slippageWarnThreshold?: number;
  onchainTaxConfig: { buyTaxBps: number; sellTaxBps: number };
  isSwapDisabled: boolean;
  isSwapping: boolean;
  swapButtonText: string;
}

const props = withDefaults(defineProps<Props>(), {
  currencySymbol: 'ETH',
  slippageWarnThreshold: 5.0,
});

const emit = defineEmits<{
  (e: 'update:tradeTab', tab: 'buy' | 'sell'): void;
  (e: 'update:amountIn', val: string): void;
  (e: 'update:payInUsd', val: boolean): void;
  (e: 'update:slippage', val: number): void;
  (e: 'update:isCustomSlippage', val: boolean): void;
  (e: 'update:customSlippageInput', val: string): void;
  (e: 'applyPercentage', percent: number): void;
  (e: 'applyQuickBuy', val: string): void;
  (e: 'openWallet'): void;
  (e: 'switchNetwork'): void;
  (e: 'executeSwap'): void;
}>();

const { t } = useI18n();

function selectSlippage(preset: number) {
  emit('update:slippage', preset);
  emit('update:isCustomSlippage', false);
  emit('update:customSlippageInput', '');
}

function formatEthBalance(wei: bigint): string {
  const isArc = props.currencySymbol === 'USDC';
  const val = Number(wei) / 1e18;
  if (val === 0) return isArc ? '0.00' : '0.0000';
  if (isArc) return val < 0.01 ? val.toFixed(4) : val.toFixed(2);
  return val < 0.0001 ? val.toFixed(6) : val.toFixed(4);
}

function formatTokenBalance(wei: bigint): string {
  const decimals = props.currentToken.decimals || 18;
  const val = Number(wei) / 10 ** decimals;
  if (val === 0) return '0.00';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.0001) return val.toFixed(4);
  return val.toFixed(6);
}
</script>
