<template>
  <div class="space-y-4 font-mono text-xs">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 1. Holder Fee Dividends Card -->
      <Card class="p-5 bg-card/90 border-border/80 space-y-3.5 shadow-2xs rounded-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Coins class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-bold text-foreground font-mono">
              Holder Fee Sharing Dividends
            </h3>
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
            <span class="text-[10px] text-muted-foreground uppercase font-mono block">
              Total Claimable
            </span>
            <p class="text-xl font-bold font-mono text-foreground">
              {{ dividendsTotalFormatted }} {{ nativeCurrencySymbol }}
            </p>
          </div>
          <Button
            v-if="isOwnProfile"
            size="sm"
            variant="default"
            class="h-8 px-4 text-xs font-semibold gap-1.5 cursor-pointer font-mono rounded-xl shadow-xs"
            :disabled="!dividendsHasAny || Boolean(dividendsActionLoading)"
            @click="emit('claim-all')"
          >
            <Loader2 v-if="dividendsActionLoading" class="w-3.5 h-3.5 animate-spin" />
            <ArrowDownToLine v-else class="w-3.5 h-3.5" />
            <span>Claim All</span>
          </Button>
        </div>

        <!-- Per-token entries -->
        <div v-if="dividendEntries.length > 0" class="space-y-2 pt-2 border-t border-border/60">
          <div
            v-for="entry in dividendEntries"
            :key="entry.tokenAddress"
            class="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-black text-xs font-mono"
          >
            <div>
              <span class="font-bold text-foreground">${{ entry.tokenSymbol }}</span>
              <span class="text-muted-foreground ml-2">
                {{ entry.earnedFormatted }} {{ nativeCurrencySymbol }}
              </span>
            </div>
            <Button
              v-if="isOwnProfile"
              size="sm"
              variant="outline"
              class="h-7 px-3 text-xs gap-1 cursor-pointer font-mono rounded-lg border-border hover:bg-muted"
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
        <p v-if="dividendsError" class="text-xs text-rose-500 font-mono">
          {{ dividendsError }}
        </p>
      </Card>

      <!-- 2. Linear Vesting Schedule Card -->
      <Card class="p-5 bg-card/90 border-border/80 space-y-3.5 shadow-2xs rounded-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Lock class="w-4 h-4 text-foreground" />
            <h3 class="text-sm font-bold text-foreground font-mono">Linear Vesting Vault</h3>
          </div>
          <Badge variant="outline" class="text-[9px] font-mono text-muted-foreground">
            Non-Custodial
          </Badge>
        </div>

        <p class="text-xs text-muted-foreground font-sans leading-relaxed">
          Smart contract vault for locked founder, advisor, and team token allocations. Tokens
          release linearly per second.
        </p>

        <div class="flex items-end justify-between pt-3 border-t border-border/60">
          <div>
            <span class="text-[10px] text-muted-foreground uppercase font-mono block">
              Vested Balance
            </span>
            <p class="text-xl font-bold font-mono text-foreground">
              0.00 {{ nativeCurrencySymbol }}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="true"
            class="h-8 px-4 text-xs font-semibold opacity-50 cursor-not-allowed font-mono rounded-xl border-border"
          >
            Claim Unlocked
          </Button>
        </div>

        <Empty
          title="No active lockup schedules"
          description="Tokens deployed with vesting schedules will show linear countdowns and claim buttons here."
          class="py-6 border border-dashed border-border bg-black"
        >
          <template #icon>
            <ShieldCheck class="w-5 h-5 text-muted-foreground" />
          </template>
        </Empty>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Coins, Loader2, RefreshCw, ArrowDownToLine, Lock, ShieldCheck } from 'lucide-vue-next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';

interface DividendEntry {
  tokenAddress: string;
  tokenSymbol: string;
  earnedFormatted: string;
}

defineProps<{
  isOwnProfile: boolean;
  dividendsLoading: boolean;
  dividendsTotalFormatted: string;
  dividendsHasAny: boolean;
  dividendsActionLoading: string | null | boolean;
  dividendEntries: DividendEntry[];
  dividendsError: string | null;
  nativeCurrencySymbol: string;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'claim-all'): void;
  (e: 'claim-single', tokenAddress: string): void;
}>();
</script>
