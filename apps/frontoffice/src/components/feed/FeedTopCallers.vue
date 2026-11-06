<template>
  <Card>
    <CardHeader class="flex-row items-center justify-between space-y-0 p-4 pb-2">
      <CardTitle class="text-sm flex items-center gap-1.5">
        <Trophy class="w-4 h-4 text-muted-foreground" />
        {{ t('topCallers') }}
      </CardTitle>
      <span class="text-xs text-muted-foreground">{{ t('profitSinceCall') }}</span>
    </CardHeader>
    <CardContent class="p-2 pt-0">
      <p v-if="callers.length === 0" class="text-xs text-muted-foreground py-4 text-center">
        {{ t('noPricedCalls') }}
      </p>
      <ol v-else class="space-y-1">
        <li
          v-for="(caller, idx) in callers"
          :key="caller.address"
          class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted/50 transition cursor-pointer"
          @click="emit('selectCaller', caller.address)"
        >
          <span class="rank" :class="idx < 3 ? 'rank-top' : ''">{{ idx + 1 }}</span>
          <Jazzicon :address="caller.address" :size="26" class="rounded-full shrink-0" />
          <div class="min-w-0 flex-1 leading-tight">
            <span class="block text-xs font-bold text-foreground truncate">
              {{ getUserIdentity(caller.address).displayName }}
            </span>
            <span class="block text-[11px] text-muted-foreground truncate">
              {{ t('callsCount', { count: String(caller.calls) }) }}
              <template v-if="caller.bestSymbol">
                · {{ t('bestCall') }} ${{ caller.bestSymbol }} {{ caller.bestPct >= 0 ? '+' : ''
                }}{{ caller.bestPct.toFixed(0) }}%
              </template>
            </span>
          </div>
          <span
            class="text-xs font-bold tabular-nums shrink-0"
            :class="caller.profitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'"
          >
            {{ caller.profitUsd >= 0 ? '+' : '-'
            }}{{ formatCompactUsd(Math.abs(caller.profitUsd)) }}
          </span>
        </li>
      </ol>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Trophy } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Jazzicon } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserIdentity } from '@/lib/username';
import { formatCompactUsd } from '@/lib/utils';
import type { TopCaller } from '@/lib/top-callers';

/** The callers whose calls have made the most since they were posted. */
defineProps<{ callers: readonly TopCaller[] }>();

const emit = defineEmits<{ (e: 'selectCaller', address: string): void }>();

const { t } = useI18n();
</script>

<style scoped>
.rank {
  width: 1.25rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.rank-top {
  color: var(--foreground);
}
</style>
