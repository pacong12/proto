<template>
  <div class="space-y-4 text-xs">
    <div class="grid grid-cols-1 gap-4">
      <!-- Holder Fee Dividends Card -->
      <Card class="p-5 bg-card/90 border-border/80 space-y-3.5 shadow-2xs rounded-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Coins class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-bold text-foreground">{{ t('holderDividendsTitle') }}</h3>
          </div>
          <Button
            v-if="isOwnProfile"
            variant="ghost"
            size="sm"
            class="h-7 w-7 p-0 rounded-lg cursor-pointer hover:bg-muted"
            title="Refresh dividends"
            :disabled="dividendsLoading"
            @click="emit('refresh')"
          >
            <Loader2 v-if="dividendsLoading" class="w-3.5 h-3.5 animate-spin" />
            <RefreshCw v-else class="w-3.5 h-3.5" />
          </Button>
        </div>

        <p class="text-xs text-muted-foreground font-sans leading-relaxed">
          Pro-rata trading fee rewards accrued from tokens you hold that enabled Holder Fee Sharing.
          100% on-chain and non-custodial.
        </p>

        <!-- Total + Claim All -->
        <div class="flex items-end justify-between pt-3 border-t border-border/60">
          <div>
            <span class="text-xs text-muted-foreground uppercase block">
              {{ t('totalClaimable') }}
            </span>
            <p
              v-for="total in dividendsTotals"
              :key="total"
              class="text-xl font-bold text-foreground"
            >
              {{ total }}
            </p>
          </div>
          <Button
            v-if="isOwnProfile"
            size="sm"
            variant="default"
            class="h-8 px-4 text-xs font-semibold gap-1.5 cursor-pointer rounded-xl shadow-xs"
            :disabled="!dividendsHasAny || Boolean(dividendsActionLoading)"
            @click="emit('claim-all')"
          >
            <Loader2 v-if="dividendsActionLoading" class="w-3.5 h-3.5 animate-spin" />
            <ArrowDownToLine v-else class="w-3.5 h-3.5" />
            <span>{{ t('claimAll') }}</span>
          </Button>
        </div>

        <!-- Per-token entries -->
        <div v-if="dividendEntries.length > 0" class="space-y-2 pt-2 border-t border-border/60">
          <div
            v-for="entry in dividendEntries"
            :key="entry.tokenAddress"
            class="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-black text-xs"
          >
            <div>
              <span class="font-bold text-foreground">${{ entry.tokenSymbol }}</span>
              <span class="text-muted-foreground ml-2">
                {{ entry.earnedFormatted }} {{ entry.currencySymbol }}
              </span>
            </div>
            <Button
              v-if="isOwnProfile"
              size="sm"
              variant="outline"
              class="h-7 px-3 text-xs gap-1 cursor-pointer rounded-lg border-border hover:bg-muted"
              :disabled="dividendsActionLoading === entry.tokenAddress"
              @click="emit('claim-single', entry.tokenAddress)"
            >
              <Loader2
                v-if="dividendsActionLoading === entry.tokenAddress"
                class="w-3 h-3 animate-spin"
              />
              Claim
            </Button>
          </div>
        </div>

        <!-- Empty state when no pending rewards -->
        <Empty
          v-else-if="!dividendsLoading"
          title="No pending fee rewards"
          description="Hold tokens with Holder Fee Sharing enabled to accumulate passive trading yield."
          class="py-6 border border-dashed border-border bg-black"
        >
          <template #icon>
            <Coins class="w-5 h-5 text-muted-foreground" />
          </template>
        </Empty>

        <!-- Error -->
        <p v-if="dividendsError" class="text-xs text-rose-500">
          {{ dividendsError }}
        </p>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Coins, Loader2, RefreshCw, ArrowDownToLine } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';

const { t } = useI18n();

interface DividendEntry {
  tokenAddress: string;
  tokenSymbol: string;
  earnedFormatted: string;
  currencySymbol: string;
}

defineProps<{
  isOwnProfile: boolean;
  dividendsLoading: boolean;
  /** One formatted amount per currency. */
  dividendsTotals: string[];
  dividendsHasAny: boolean;
  dividendsActionLoading: string | null | boolean;
  dividendEntries: DividendEntry[];
  dividendsError: string | null;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'claim-all'): void;
  (e: 'claim-single', tokenAddress: string): void;
}>();
</script>
