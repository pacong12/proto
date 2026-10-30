<template>
  <div v-if="team" class="rounded-2xl border border-border bg-card p-4 space-y-3 text-sm">
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-bold text-foreground">{{ t('teamPayouts') }}</h3>
      <a
        :href="`${network.blockExplorer}/address/${team.address}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-muted-foreground hover:text-foreground"
        >{{ shortenAddress(team.address) }}</a
      >
    </div>
    <p class="text-xs text-muted-foreground">{{ t('teamPayoutsHint') }}</p>

    <ul class="space-y-1.5">
      <li
        v-for="m in team.members"
        :key="m.address"
        class="flex items-center justify-between gap-2 text-xs"
      >
        <span class="min-w-0 truncate">
          <span class="font-semibold text-foreground">{{
            getUserIdentity(m.address).displayName
          }}</span>
          <span class="text-muted-foreground"> · {{ (m.shareBps / 100).toFixed(2) }}%</span>
        </span>
        <span class="text-right tabular-nums text-muted-foreground shrink-0">
          <span v-for="(a, i) in team.assets" :key="a.address">
            {{ i > 0 ? ' · ' : '' }}{{ formatRawAmount(m.due[i], a.decimals) }} {{ a.symbol }}
          </span>
        </span>
      </li>
    </ul>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="(a, i) in team.assets"
        :key="a.address"
        size="sm"
        variant="outline"
        class="h-8 text-xs rounded-xl"
        :disabled="busy || !team.members.some((m) => m.due[i] > 0n)"
        @click="releaseAll(a.address)"
      >
        {{ t('releaseAll') }} {{ a.symbol }}
      </Button>
    </div>
    <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { type NetworkConfig } from '@goton/shared-types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useI18n } from '@/lib/i18n';
import { formatRawAmount } from '@/lib/limit-orders';
import { shortenAddress } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { readTeamPayouts, releaseTeamAsset, type TeamPayouts } from '@/composables/useTeamFees';

const props = defineProps<{
  token: `0x${string}`;
  symbol: string;
  network: NetworkConfig;
}>();
const { t } = useI18n();

const team = ref<TeamPayouts | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

async function load() {
  team.value = await readTeamPayouts(props.network, props.token, props.symbol);
}

async function releaseAll(asset: `0x${string}`) {
  if (!team.value) return;
  busy.value = true;
  error.value = null;
  try {
    await releaseTeamAsset(props.network, team.value.address, asset);
    toast.success(t('teamPaid'));
    await load();
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (!/user rejected|denied/i.test(msg)) error.value = msg.split('\n')[0];
  } finally {
    busy.value = false;
  }
}

watch(() => [props.token, props.network.chainId], load, { immediate: true });
</script>
