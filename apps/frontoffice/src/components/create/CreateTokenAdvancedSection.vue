<template>
  <Card class="rounded-2xl border border-border bg-card overflow-hidden p-0 shadow-xs">
    <Button
      type="button"
      variant="ghost"
      @click="isOpen = !isOpen"
      class="w-full flex items-center justify-between px-5 py-4 h-auto text-sm font-semibold transition hover:bg-muted/40 cursor-pointer rounded-none"
    >
      <div class="flex items-center gap-2">
        <span class="font-bold">{{ t('advanced') }}</span>
        <span class="text-xs text-muted-foreground">
          (Buy: {{ buyTax }}% &middot; Sell: {{ sellTax }}% &middot; Split: {{ totalSplit }}/100%)
        </span>
      </div>
      <ChevronDown
        class="w-3.5 h-3.5 transition-transform duration-200 opacity-60"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </Button>

    <div v-show="isOpen" class="p-6 sm:p-7 space-y-7 border-t border-border">
      <!-- Connected Creator Wallet -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Label class="text-sm font-semibold">{{ t('creatorWallet') }}</Label>
            <InfoTooltip
              text="Receives creator fees, trading taxes, and governance permissions. Defaults to your connected wallet if left blank."
            />
          </div>
          <button
            v-if="account && creatorWallet !== account"
            type="button"
            class="text-xs text-primary hover:underline cursor-pointer"
            @click="$emit('update:creatorWallet', account)"
          >
            Use Connected Wallet
          </button>
        </div>
        <Input
          :model-value="creatorWallet"
          type="text"
          :placeholder="account || '0x... (defaults to deployer)'"
          class="h-10 text-xs rounded-xl bg-muted/20"
          @update:model-value="$emit('update:creatorWallet', String($event))"
        />
        <p class="text-xs text-muted-foreground">
          Recipient for fee revenue and tax collections. Defaults to
          {{ account ? shortenAddress(account) : 'deployer' }}.
        </p>
      </div>

      <!-- Trading Taxes (Buy & Sell Tax) with Quick Presets -->
      <div class="space-y-3.5 pt-4 border-t border-border">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Label class="text-sm font-semibold text-foreground">{{
              t('tradingTaxesOptional')
            }}</Label>
            <InfoTooltip
              text="Initial tax configured here is activated immediately upon token launch. Defaults to 0% for pure meme coins. Post-launch changes will require a 24-hour timelock to protect holders."
            />
          </div>
          <span class="text-xs text-muted-foreground">{{ t('defaultZeroMaxTen') }}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <!-- Buy Tax with Slider -->
          <div class="space-y-3.5 p-4 sm:p-5 rounded-2xl border border-border bg-card">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1">
                <span class="text-xs font-medium text-foreground">{{ t('buyTax') }}</span>
                <InfoTooltip
                  text="Fee deducted when users purchase tokens. Recommended: 1% - 5%."
                />
              </div>
              <span class="text-xs font-bold text-foreground">{{ buyTax }}%</span>
            </div>
            <Slider
              :model-value="[parseFloat(buyTax || '0')]"
              :max="10"
              :min="0"
              :step="0.5"
              range-class="bg-foreground"
              thumb-class="border-foreground focus-visible:ring-foreground"
              class="py-1"
              @update:model-value="$emit('update:buyTax', String($event ? $event[0] : 0))"
            />
            <div class="flex items-center gap-1.5 pt-1">
              <Button
                v-for="p in [0, 1, 2, 5, 10]"
                :key="p"
                type="button"
                size="sm"
                :variant="parseFloat(buyTax || '0') === p ? 'default' : 'outline'"
                class="flex-1 h-7 text-xs p-0 cursor-pointer"
                @click="$emit('update:buyTax', String(p))"
              >
                {{ p }}%
              </Button>
            </div>
          </div>

          <!-- Sell Tax with Slider -->
          <div class="space-y-3.5 p-4 sm:p-5 rounded-2xl border border-border bg-card">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1">
                <span class="text-xs font-medium text-foreground">{{ t('sellTax') }}</span>
                <InfoTooltip
                  text="Fee deducted when users sell tokens back into the pool. Discourages immediate dumping."
                />
              </div>
              <span class="text-xs font-bold text-foreground">{{ sellTax }}%</span>
            </div>
            <Slider
              :model-value="[parseFloat(sellTax || '0')]"
              :max="10"
              :min="0"
              :step="0.5"
              range-class="bg-foreground"
              thumb-class="border-foreground focus-visible:ring-foreground"
              class="py-1"
              @update:model-value="$emit('update:sellTax', String($event ? $event[0] : 0))"
            />
            <div class="flex items-center gap-1.5 pt-1">
              <Button
                v-for="p in [0, 1, 2, 5, 10]"
                :key="p"
                type="button"
                size="sm"
                :variant="parseFloat(sellTax || '0') === p ? 'destructive' : 'outline'"
                class="flex-1 h-7 text-xs p-0 cursor-pointer"
                @click="$emit('update:sellTax', String(p))"
              >
                {{ p }}%
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Revenue Split Allocation -->
      <div class="space-y-4 pt-4 border-t border-border">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-1.5">
              <Label class="text-sm font-semibold text-foreground">{{ t('revenueSplit') }}</Label>
              <InfoTooltip
                text="Specifies how collected trading taxes are distributed on-chain. Allocations must sum to exactly 100% to launch."
              />
            </div>
            <p class="text-xs text-muted-foreground">{{ t('feeAllocationMustTotal') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              v-if="totalSplit !== 100"
              type="button"
              size="sm"
              variant="outline"
              class="h-6 px-2 text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10 cursor-pointer"
              @click="handleAutoBalance"
            >
              {{ t('autoBalance') }}
            </Button>
            <Badge
              :variant="totalSplit === 100 ? 'default' : 'outline'"
              class="text-xs"
              :class="totalSplit !== 100 ? 'border-amber-500 text-amber-500' : ''"
            >
              {{ totalSplit }}/100%
            </Badge>
          </div>
        </div>

        <!-- Quick Presets with Shadcn Button -->
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            :variant="isPreset(50, 0, 50, 0) ? 'default' : 'outline'"
            class="h-7 text-xs cursor-pointer"
            @click="setPreset(50, 0, 50, 0)"
          >
            <span class="hidden sm:inline">50/50 Creator & Holders</span>
            <span class="sm:hidden">50/50 Split</span>
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="isPreset(100, 0, 0, 0) ? 'default' : 'outline'"
            class="h-7 text-xs cursor-pointer"
            @click="setPreset(100, 0, 0, 0)"
          >
            100% Creator
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="isPreset(40, 20, 40, 0) ? 'default' : 'outline'"
            class="h-7 text-xs cursor-pointer"
            @click="setPreset(40, 20, 40, 0)"
          >
            <span class="hidden sm:inline">40/40/20 Buyback</span>
            <span class="sm:hidden">40/40/20</span>
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="isPreset(25, 25, 25, 25) ? 'default' : 'outline'"
            class="h-7 text-xs cursor-pointer"
            @click="setPreset(25, 25, 25, 25)"
          >
            25% Equal
          </Button>
        </div>

        <!-- Donut Chart & Sliders Section -->
        <div
          class="flex flex-col lg:flex-row gap-8 items-center lg:items-start p-6 sm:p-7 rounded-2xl border border-border bg-card"
        >
          <!-- Circular Donut Chart (Distinct 4-Color Breakdown) -->
          <div class="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="38"
                stroke="currentColor"
                stroke-width="12"
                fill="transparent"
                class="text-muted/60"
              />
              <circle
                v-if="revenueSplit.creator > 0"
                cx="50"
                cy="50"
                r="38"
                stroke="var(--chart-2)"
                stroke-width="12"
                fill="transparent"
                :stroke-dasharray="`${donutData.segments.creator.stroke} ${donutData.circumference}`"
                :stroke-dashoffset="donutData.segments.creator.offset"
                class="transition-all duration-300"
              />
              <circle
                v-if="revenueSplit.buyback > 0"
                cx="50"
                cy="50"
                r="38"
                stroke="var(--bearish)"
                stroke-width="12"
                fill="transparent"
                :stroke-dasharray="`${donutData.segments.buyback.stroke} ${donutData.circumference}`"
                :stroke-dashoffset="donutData.segments.buyback.offset"
                class="transition-all duration-300"
              />
              <circle
                v-if="revenueSplit.holders > 0"
                cx="50"
                cy="50"
                r="38"
                stroke="var(--chart-4)"
                stroke-width="12"
                fill="transparent"
                :stroke-dasharray="`${donutData.segments.holders.stroke} ${donutData.circumference}`"
                :stroke-dashoffset="donutData.segments.holders.offset"
                class="transition-all duration-300"
              />
              <circle
                v-if="revenueSplit.growth > 0"
                cx="50"
                cy="50"
                r="38"
                stroke="var(--chart-1)"
                stroke-width="12"
                fill="transparent"
                :stroke-dasharray="`${donutData.segments.growth.stroke} ${donutData.circumference}`"
                :stroke-dashoffset="donutData.segments.growth.offset"
                class="transition-all duration-300"
              />
            </svg>

            <!-- Center Text inside Donut -->
            <div
              class="absolute inset-0 flex flex-col items-center justify-center text-center select-none"
            >
              <span
                class="text-lg font-bold leading-tight"
                :class="totalSplit === 100 ? 'text-foreground' : 'text-amber-500'"
              >
                {{ totalSplit }}%
              </span>
              <span class="text-xs text-muted-foreground uppercase tracking-wider"> Split </span>
            </div>
          </div>

          <!-- 4 Allocation Share Sliders -->
          <div class="flex-1 w-full space-y-5">
            <!-- Creator Share Slider -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5 font-semibold text-foreground">
                  <span>{{ t('creatorShare') }}</span>
                  <InfoTooltip text="Portion of swap taxes sent directly to the creator wallet." />
                </div>
                <span class="font-bold text-foreground"> {{ revenueSplit.creator }}% </span>
              </div>
              <Slider
                :model-value="[revenueSplit.creator]"
                :max="100"
                :min="0"
                :step="1"
                range-class="bg-foreground"
                thumb-class="border-foreground focus-visible:ring-foreground"
                @update:model-value="updatePillar('creator', $event ? $event[0] : 0)"
              />
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ t('creatorRevenueShare') }}</span>
                <span class="font-semibold">{{ revenueSplit.creator }}%</span>
              </div>
            </div>

            <!-- Buyback & Burn Slider -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5 font-semibold text-foreground">
                  <span>{{ t('buybackAndBurn') }}</span>
                  <InfoTooltip
                    text="Automatically buys tokens off the pool and permanently burns them to reduce supply."
                  />
                </div>
                <span class="font-bold text-foreground"> {{ revenueSplit.buyback }}% </span>
              </div>
              <Slider
                :model-value="[revenueSplit.buyback]"
                :max="100"
                :min="0"
                :step="1"
                range-class="bg-foreground"
                thumb-class="border-foreground focus-visible:ring-foreground"
                @update:model-value="updatePillar('buyback', $event ? $event[0] : 0)"
              />
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ t('deflationaryBuybackShare') }}</span>
                <span class="font-semibold">{{ revenueSplit.buyback }}%</span>
              </div>
            </div>

            <!-- Holder Dividends Slider -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5 font-semibold text-foreground">
                  <span>{{ t('holderDividends') }}</span>
                  <InfoTooltip
                    text="Distributed proportionally in native currency to all token holders as passive yield."
                  />
                </div>
                <span class="font-bold text-foreground"> {{ revenueSplit.holders }}% </span>
              </div>
              <Slider
                :model-value="[revenueSplit.holders]"
                :max="100"
                :min="0"
                :step="1"
                range-class="bg-foreground"
                thumb-class="border-foreground focus-visible:ring-foreground"
                @update:model-value="updatePillar('holders', $event ? $event[0] : 0)"
              />
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ t('holderDividendShare') }}</span>
                <span class="font-semibold">{{ revenueSplit.holders }}%</span>
              </div>
            </div>

            <!-- Liquidity Growth Slider -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5 font-semibold text-foreground">
                  <span>{{ t('liquidityGrowth') }}</span>
                  <InfoTooltip
                    text="Permanently injected into the liquidity pool to deepen market depth and reduce slippage."
                  />
                </div>
                <span class="font-bold text-foreground"> {{ revenueSplit.growth }}% </span>
              </div>
              <Slider
                :model-value="[revenueSplit.growth]"
                :max="100"
                :min="0"
                :step="1"
                range-class="bg-foreground"
                thumb-class="border-foreground focus-visible:ring-foreground"
                @update:model-value="updatePillar('growth', $event ? $event[0] : 0)"
              />
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ t('liquidityInjectionShare') }}</span>
                <span class="font-semibold">{{ revenueSplit.growth }}%</span>
              </div>
            </div>

            <!-- Bottom summary info -->
            <div
              class="pt-4 mt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <span class="text-muted-foreground">
                Each share stops where the others leave off. They must total 100% to launch.
              </span>
              <span
                class="font-semibold shrink-0"
                :class="totalSplit === 100 ? 'text-foreground' : 'text-amber-500'"
              >
                {{
                  totalSplit === 100 ? 'Allocation totals 100%' : `${100 - totalSplit}% remaining`
                }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Anti-Snipe Notice -->
      <div
        class="p-4 rounded-xl border border-border bg-black text-xs text-muted-foreground space-y-1.5"
      >
        <div class="font-semibold text-foreground flex items-center gap-1">
          <span>{{ t('antiSnipeSafeguard') }}</span>
          <InfoTooltip
            text="Applies a decaying 99% snipe tax on block 0 that drops smoothly to 0% in 3 seconds to defend against MEV bots."
          />
        </div>
        <p>
          {{ t('antiSnipeSafeguardDesc') }}
        </p>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { InfoTooltip } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/i18n';
import { shortenAddress } from '@/lib/utils';
import {
  type RevenueSplit,
  calculateTotalSplit,
  autoBalanceSplit,
  adjustShareDynamically,
  calculateDonutSegments,
} from '@proto/math-sdk';

const { t } = useI18n();

interface Props {
  account?: string | null;
  creatorWallet: string;
  buyTax: string;
  sellTax: string;
  revenueSplit: RevenueSplit;
  open: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  account: '',
  open: false,
});

const emit = defineEmits<{
  (e: 'update:creatorWallet', val: string): void;
  (e: 'update:buyTax', val: string): void;
  (e: 'update:sellTax', val: string): void;
  (e: 'update:revenueSplit', val: RevenueSplit): void;
  (e: 'update:open', val: boolean): void;
}>();

const isOpen = computed({
  get: () => props.open,
  set: (val: boolean) => emit('update:open', val),
});

const totalSplit = computed(() => calculateTotalSplit(props.revenueSplit));

const donutData = computed(() => calculateDonutSegments(props.revenueSplit, 38));

function isPreset(c: number, b: number, h: number, g: number): boolean {
  const s = props.revenueSplit;
  return s.creator === c && s.buyback === b && s.holders === h && s.growth === g;
}

function setPreset(creator: number, buyback: number, holders: number, growth: number) {
  emit('update:revenueSplit', { creator, buyback, holders, growth });
}

function handleAutoBalance() {
  emit('update:revenueSplit', autoBalanceSplit(props.revenueSplit));
}

function updatePillar(key: keyof RevenueSplit, val: unknown) {
  const requested = Math.round(Number(val) || 0);
  const next = adjustShareDynamically(props.revenueSplit, key, requested);
  emit('update:revenueSplit', next);
}
</script>
