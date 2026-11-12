<template>
  <div class="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <div class="text-xs font-bold text-foreground">{{ t('referralTitle') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('referralSubtitle') }}</div>
      </div>
      <div class="text-right">
        <div class="text-lg font-bold text-foreground tabular-nums">{{ stats.count }}</div>
        <div class="text-xs text-muted-foreground">{{ t('referralReferred') }}</div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <Input :model-value="link" readonly class="h-8 text-xs" @focus="selectAll" />
      <Button
        size="sm"
        variant="outline"
        class="h-8 px-2.5 text-xs gap-1 rounded-lg cursor-pointer shrink-0"
        @click="copy"
      >
        <Check v-if="copied" class="w-3.5 h-3.5 text-emerald-500" />
        <Copy v-else class="w-3.5 h-3.5" />
        <span>{{ copied ? t('pnlLinkCopied') : t('pnlCopyLink') }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Check, Copy } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { SITE } from '@/lib/site';
import { fetchReferralStats, type ReferralStats } from '@/lib/referral';

const props = defineProps<{ wallet: string }>();
const { t } = useI18n();

const stats = ref<ReferralStats>({ count: 0, referees: [] });
const copied = ref(false);

const link = computed(() => `${SITE.appUrl}/?ref=${props.wallet}`);

async function load() {
  if (props.wallet) stats.value = await fetchReferralStats(props.wallet);
}
onMounted(load);
watch(() => props.wallet, load);

function selectAll(e: FocusEvent) {
  (e.target as HTMLInputElement | null)?.select();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // clipboard unavailable
  }
}
</script>
