<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs font-semibold gap-1.5 cursor-pointer rounded-xl"
      >
        <UserPlus class="w-3.5 h-3.5" />
        {{ t('referralTitle') }}
        <span v-if="stats.count" class="tabular-nums text-muted-foreground">{{ stats.count }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-80 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-muted-foreground leading-snug">{{ t('referralSubtitle') }}</p>
        <div class="text-right shrink-0">
          <div class="text-lg font-semibold text-foreground tabular-nums leading-none">
            {{ stats.count }}
          </div>
          <div class="text-xs text-muted-foreground mt-1">{{ t('referralReferred') }}</div>
        </div>
      </div>

      <!-- The shareable invite card: name, photo and a QR of the link. Hidden if it fails. -->
      <div
        v-if="cardState !== 'failed'"
        class="relative w-full aspect-[1200/630] overflow-hidden rounded-lg border border-border"
      >
        <Skeleton v-if="cardState === 'loading'" class="absolute inset-0 rounded-none" />
        <img
          :key="cardUrl"
          :src="cardUrl"
          :alt="t('referralTitle')"
          width="1200"
          height="630"
          class="absolute inset-0 w-full h-full object-cover transition-opacity"
          :class="cardState === 'ready' ? 'opacity-100' : 'opacity-0'"
          @load="cardState = 'ready'"
          @error="cardState = 'failed'"
        />
      </div>

      <Button size="sm" class="w-full h-9 gap-1.5 cursor-pointer rounded-lg" @click="copy">
        <Check v-if="copied" class="w-4 h-4" />
        <Copy v-else class="w-4 h-4" />
        {{ copied ? t('pnlLinkCopied') : t('pnlCopyLink') }}
      </Button>
      <div class="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          class="h-9 gap-1.5 cursor-pointer rounded-lg"
          :disabled="saving || cardState === 'failed'"
          @click="saveCard"
        >
          <Download class="w-4 h-4" />
          {{ t('pnlSaveImage') }}
        </Button>
        <Button size="sm" variant="outline" class="h-9 cursor-pointer rounded-lg" @click="postOnX">
          {{ t('pnlPostOnX') }}
        </Button>
      </div>

      <!-- The latest wallets this link brought in. -->
      <div class="border-t border-border pt-3">
        <p v-if="!stats.count" class="text-xs text-muted-foreground">{{ t('referralNone') }}</p>
        <ul v-else class="space-y-1">
          <li v-for="r in recent" :key="r.referee">
            <RouterLink
              :to="`/${r.identity.slug}`"
              class="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-muted transition"
            >
              <Jazzicon :address="r.referee" :size="22" class="rounded-full shrink-0" />
              <span class="text-sm text-foreground truncate min-w-0 flex-1">
                {{ r.identity.displayName }}
              </span>
              <span class="text-xs text-muted-foreground shrink-0">
                {{ formatRelativeTime(r.createdAt) }}
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="stats.count > recent.length" class="text-xs text-muted-foreground mt-1.5 px-1.5">
          {{ t('referralMore', { count: String(stats.count - recent.length) }) }}
        </p>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Check, Copy, Download, UserPlus } from 'lucide-vue-next';
import { toast } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { API_BASE_URL } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Jazzicon } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n';
import { SITE } from '@/lib/site';
import { formatRelativeTime } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { fetchReferralStats, withReferral, type ReferralStats } from '@/lib/referral';

/** The owner's invite button: copy the referral link, see who it brought in. */
const props = defineProps<{ wallet: string }>();
const { t } = useI18n();

const RECENT_LIMIT = 5;
const stats = ref<ReferralStats>({ count: 0, referees: [] });
const copied = ref(false);

const link = computed(() => withReferral(`${SITE.appUrl}/`, props.wallet));
const cardUrl = computed(
  () => `${API_BASE_URL}/api/referrals/${props.wallet.toLowerCase()}/card.png`,
);
const saving = ref(false);
/** The card image: its preview and Save are dropped when the API cannot draw it. */
const cardState = ref<'loading' | 'ready' | 'failed'>('loading');
watch(cardUrl, () => (cardState.value = 'loading'));

async function saveCard() {
  saving.value = true;
  try {
    const res = await fetch(cardUrl.value);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goton-invite.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    toast.error(t('pnlImageFailed'));
  } finally {
    saving.value = false;
  }
}

function postOnX() {
  const text = `Join me on @gotondotfun: launch and trade memecoins on-chain.\n${link.value}`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer',
  );
}
const recent = computed(() =>
  stats.value.referees.slice(0, RECENT_LIMIT).map((r) => ({
    ...r,
    identity: getUserIdentity(r.referee),
  })),
);

async function load() {
  if (props.wallet) stats.value = await fetchReferralStats(props.wallet);
}
onMounted(load);
watch(() => props.wallet, load);

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
