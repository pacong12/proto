<template>
  <div class="max-w-3xl mx-auto space-y-4 pb-16 font-sans">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-lg font-bold tracking-tight text-foreground truncate">
          {{
            share
              ? t('pnlPageTitle', { name: share.traderName, symbol: share.token.symbol })
              : t('pnlShareTitle')
          }}
        </h1>
        <RouterLink
          :to="`/u/${wallet}`"
          class="text-xs text-muted-foreground font-mono hover:text-foreground transition"
        >
          {{ shortAddress(wallet) }}
        </RouterLink>
      </div>
      <Button v-if="share" as-child size="sm" class="rounded-xl font-bold">
        <RouterLink :to="`/token/${token}`">
          {{ t('pnlTradeToken', { symbol: share.token.symbol }) }}
        </RouterLink>
      </Button>
    </header>
    <PnlShareCard :wallet="wallet" :token="token" details @loaded="onLoaded" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PnlShare } from '@goton/shared-types';
import { Button } from '@/components/ui/button';
import { PnlShareCard } from '@/components/pnl';
import { useI18n } from '@/lib/i18n';
import { setPageSeo } from '@/lib/seo';

/** A shared PnL page: one wallet's position in one token. */
const props = defineProps<{ wallet: string; token: string }>();
const { t } = useI18n();
const share = ref<PnlShare | null>(null);

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function onLoaded(value: PnlShare | null) {
  share.value = value;
  if (value) {
    setPageSeo(`/pnl/${props.wallet.toLowerCase()}/${props.token.toLowerCase()}`, {
      title: t('pnlPageTitle', { name: value.traderName, symbol: value.token.symbol }),
      noindex: true,
    });
  }
}
</script>
