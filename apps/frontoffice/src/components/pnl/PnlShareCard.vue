<template>
  <div class="space-y-3">
    <div
      class="relative w-full aspect-[1200/630] rounded-xl border border-border overflow-hidden bg-muted"
    >
      <p
        v-if="notFound"
        class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground"
      >
        {{ t('pnlNoPosition') }}
      </p>
      <template v-else-if="share">
        <div v-if="!imageLoaded" class="absolute inset-0 animate-pulse bg-muted" />
        <img
          :src="cardUrl"
          :alt="t('pnlCardAlt', { name: share.traderName })"
          width="1200"
          height="630"
          class="w-full h-full object-cover"
          @load="imageLoaded = true"
        />
      </template>
      <div v-else class="absolute inset-0 animate-pulse bg-muted" />
    </div>

    <dl
      v-if="details && share"
      class="grid grid-cols-2 sm:grid-cols-3 gap-px rounded-xl border border-border overflow-hidden bg-border text-xs"
    >
      <div
        v-for="(row, i) in rows"
        :key="row.label"
        class="bg-card p-3 space-y-1"
        :class="{ 'col-span-2 sm:col-span-3': i === 0 }"
      >
        <dt class="text-muted-foreground">{{ row.label }}</dt>
        <dd class="font-bold text-sm" :class="row.tone">{{ row.value }}</dd>
      </div>
    </dl>

    <div v-if="share" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Button variant="outline" class="h-9 gap-1.5 rounded-xl text-xs font-bold" @click="saveImage">
        <Download class="w-3.5 h-3.5" />
        {{ t('pnlSaveImage') }}
      </Button>
      <Button variant="outline" class="h-9 gap-1.5 rounded-xl text-xs font-bold" @click="copyImage">
        <ImageIcon class="w-3.5 h-3.5" />
        {{ t('pnlCopyImage') }}
      </Button>
      <Button variant="outline" class="h-9 gap-1.5 rounded-xl text-xs font-bold" @click="copyLink">
        <Link2 class="w-3.5 h-3.5" />
        {{ t('pnlCopyLink') }}
      </Button>
      <Button
        class="h-9 gap-1.5 rounded-xl text-xs font-bold bg-foreground text-background hover:opacity-90"
        @click="postOnX"
      >
        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          />
        </svg>
        {{ t('pnlPostOnX') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import type { PnlShare } from '@goton/shared-types';
import { Download, Image as ImageIcon, Link2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { formatCompactUsd, formatMarketCap } from '@/lib/utils';
import { formatSignedPercent, formatSignedUsd, usePnlShare } from '@/composables/usePnlShare';

const props = defineProps<{
  wallet?: string;
  token?: string;
  /** Also list the figures behind the card. */
  details?: boolean;
}>();

const { t } = useI18n();
const { share, notFound, cardUrl, saveImage, copyImage, copyLink, postOnX } = usePnlShare(
  toRef(props, 'wallet'),
  toRef(props, 'token'),
);
const emit = defineEmits<{ (e: 'loaded', share: PnlShare | null): void }>();
watch(share, (value) => emit('loaded', value));

const imageLoaded = ref(false);
watch(cardUrl, () => (imageLoaded.value = false));

const tone = (value: number) => (value < 0 ? 'text-rose-500' : 'text-emerald-500');

const rows = computed(() => {
  const pnl = share.value?.pnl;
  if (!pnl) return [];
  return [
    {
      label: t('pnlTotal'),
      value: `${formatSignedUsd(pnl.totalUsd)} ${formatSignedPercent(pnl.percent)}`,
      tone: tone(pnl.totalUsd),
    },
    {
      label: t('pnlRealized'),
      value: formatSignedUsd(pnl.realizedUsd),
      tone: tone(pnl.realizedUsd),
    },
    {
      label: t('pnlUnrealized'),
      value: formatSignedUsd(pnl.unrealizedUsd),
      tone: tone(pnl.unrealizedUsd),
    },
    { label: t('pnlInvested'), value: formatCompactUsd(pnl.investedUsd), tone: '' },
    { label: t('pnlAverageEntry'), value: formatMarketCap(pnl.avgEntryMarketCapUsd), tone: '' },
    pnl.status === 'sold'
      ? { label: t('pnlAverageExit'), value: formatMarketCap(pnl.avgExitMarketCapUsd), tone: '' }
      : { label: t('pnlMarketCap'), value: formatMarketCap(pnl.marketCapUsd), tone: '' },
    {
      label: t('pnlTrades'),
      value: t('pnlBuysSells', { buys: String(pnl.buys), sells: String(pnl.sells) }),
      tone: '',
    },
  ];
});
</script>
