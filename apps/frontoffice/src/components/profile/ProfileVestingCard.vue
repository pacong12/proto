<template>
  <Card
    v-for="position in positions"
    :key="`${position.network.chainId}-${position.id}`"
    class="bg-card border-border p-5 space-y-3"
  >
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h3 class="font-bold text-sm text-foreground flex items-center gap-2">
        <Lock class="w-4 h-4" />
        {{ t('vestingCardTitle') }}: ${{ position.symbol }}
      </h3>
      <span class="text-xs text-muted-foreground">{{ position.network.name }}</span>
    </div>

    <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
      <div v-for="row in rows(position)" :key="row.label">
        <dt class="text-muted-foreground">{{ row.label }}</dt>
        <dd class="font-semibold text-foreground">{{ row.value }}</dd>
      </div>
    </dl>

    <div class="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        class="cursor-pointer"
        :disabled="busy || position.releasable === 0n"
        @click="onClaim(position, 'claimVested')"
      >
        {{ t('vestingClaimTokens') }}
      </Button>
      <Button
        v-if="position.pendingDividends > 0n"
        variant="outline"
        size="sm"
        class="cursor-pointer"
        :disabled="busy"
        @click="onClaim(position, 'claimDividends')"
      >
        {{ t('vestingClaimDividends') }}:
        {{ formatAmount(position.pendingDividends, position.network.quoteTokenDecimals) }}
        {{ position.network.nativeCurrency.symbol }}
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { formatUnits } from 'viem';
import { Lock } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { useI18n } from '@/lib/i18n';
import {
  useVestingSchedules,
  type NetworkVestingPosition,
} from '@/composables/useVestingSchedules';

const props = defineProps<{ account: `0x${string}` }>();

const { t } = useI18n();
const { positions, busy, error, claim } = useVestingSchedules(toRef(props, 'account'));

function formatAmount(wei: bigint, decimals = 18): string {
  return Number(formatUnits(wei, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

function rows(position: NetworkVestingPosition) {
  return [
    { label: t('vestingTotal'), value: formatAmount(position.total) },
    { label: t('vestingClaimed'), value: formatAmount(position.claimed) },
    { label: t('vestingClaimable'), value: formatAmount(position.releasable) },
    { label: t('vestingCliffEnds'), value: formatDate(position.cliffEndsAt) },
    { label: t('vestingFullyUnlocked'), value: formatDate(position.fullyUnlockedAt) },
  ];
}

async function onClaim(
  position: NetworkVestingPosition,
  functionName: 'claimVested' | 'claimDividends',
) {
  const hash = await claim(position, functionName);
  if (hash) toast.success(t('vestingClaimDone'));
  else if (error.value) toast.error(error.value);
}
</script>
