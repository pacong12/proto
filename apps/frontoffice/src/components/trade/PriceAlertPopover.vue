<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-7 px-2.5 text-xs font-bold gap-1 rounded-xl border-border cursor-pointer"
        :title="t('alertsTitle')"
      >
        <Bell class="w-3.5 h-3.5" />
        <span v-if="tokenAlerts.length" class="tabular-nums">{{ tokenAlerts.length }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-72 p-3 space-y-3">
      <div class="text-xs font-bold text-foreground">{{ t('alertsTitle') }}</div>

      <div v-if="!account" class="text-xs text-muted-foreground">
        {{ t('alertConnectWallet') }}
      </div>

      <template v-else>
        <!-- Kind: price vs market cap -->
        <div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
          <button
            v-for="k in ['price', 'mcap'] as const"
            :key="k"
            type="button"
            class="h-7 rounded-md text-xs font-semibold cursor-pointer transition"
            :class="kind === k ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'"
            @click="setKind(k)"
          >
            {{ k === 'mcap' ? t('alertKindMcap') : t('alertKindPrice') }}
          </button>
        </div>

        <!-- Direction + threshold -->
        <div class="flex items-center gap-2">
          <div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5 shrink-0">
            <button
              v-for="d in ['above', 'below'] as const"
              :key="d"
              type="button"
              class="h-7 px-2 rounded-md text-xs font-semibold cursor-pointer transition"
              :class="
                direction === d ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              "
              @click="direction = d"
            >
              {{ d === 'above' ? t('alertAbove') : t('alertBelow') }}
            </button>
          </div>
          <Input
            v-model="thresholdInput"
            inputmode="decimal"
            placeholder="0.00"
            class="h-8 text-xs"
          />
        </div>

        <Button
          size="sm"
          class="w-full h-8 text-xs font-semibold rounded-lg cursor-pointer"
          :disabled="creating || !(parsedThreshold > 0)"
          @click="submit"
        >
          <Loader2 v-if="creating" class="w-3 h-3 animate-spin mr-1" />
          {{ t('alertCreate') }}
        </Button>

        <!-- Existing alerts for this token -->
        <div v-if="tokenAlerts.length" class="space-y-1 pt-1 border-t border-border/60">
          <div
            v-for="a in tokenAlerts"
            :key="a.id"
            class="flex items-center justify-between gap-2 text-xs"
          >
            <span class="text-muted-foreground tabular-nums">
              {{ a.kind === 'mcap' ? t('alertKindMcap') : t('alertKindPrice') }}
              {{ a.direction === 'above' ? '>=' : '<=' }}
              {{ formatCompactUsd(a.threshold) }}
              <span v-if="a.status === 'triggered'" class="text-emerald-500">•</span>
            </span>
            <button
              type="button"
              class="text-muted-foreground hover:text-rose-500 cursor-pointer"
              :title="t('alertRemove')"
              @click="removeAlert(a.id)"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div v-else class="text-xs text-muted-foreground">{{ t('alertNone') }}</div>

        <!-- Browser push notifications -->
        <div
          v-if="pushSupported"
          class="flex items-center justify-between gap-2 pt-2 border-t border-border/60"
        >
          <span class="text-xs text-muted-foreground">{{ t('alertPush') }}</span>
          <Button
            size="sm"
            variant="outline"
            class="h-7 px-2.5 text-xs font-semibold rounded-lg cursor-pointer"
            :disabled="pushBusy"
            @click="togglePush"
          >
            <Loader2 v-if="pushBusy" class="w-3 h-3 animate-spin mr-1" />
            {{ pushOn ? t('alertPushOn') : t('alertPushEnable') }}
          </Button>
        </div>
      </template>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Bell, Loader2, X } from 'lucide-vue-next';
import type { PriceAlert } from '@goton/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useI18n } from '@/lib/i18n';
import { formatCompactUsd } from '@/lib/utils';
import { usePriceAlerts } from '@/composables/usePriceAlerts';
import { isPushSupported, isPushEnabled, enablePush, disablePush } from '@/lib/push';
import { toast } from '@/components/ui/sonner';

const props = defineProps<{
  token: string;
  chainId: number;
  priceUsd: number;
  marketCapUsd: number;
  account?: string | null;
}>();

const { t } = useI18n();
const { alerts, create, remove, load } = usePriceAlerts();

const open = ref(false);
const kind = ref<PriceAlert['kind']>('mcap');
const direction = ref<PriceAlert['direction']>('above');
const thresholdInput = ref('');
const creating = ref(false);

const parsedThreshold = computed(() => Number(thresholdInput.value.replace(/,/g, '')) || 0);
const tokenAlerts = computed(() =>
  alerts.value.filter((a) => a.tokenAddress.toLowerCase() === props.token.toLowerCase()),
);

/** Prefill the threshold with the current value for the chosen kind. */
function setKind(k: PriceAlert['kind']) {
  kind.value = k;
  const current = k === 'mcap' ? props.marketCapUsd : props.priceUsd;
  if (current > 0) thresholdInput.value = String(current);
}

const pushSupported = isPushSupported();
const pushOn = ref(false);
const pushBusy = ref(false);

watch(
  () => [open.value, props.account] as const,
  ([isOpen, account]) => {
    if (isOpen && account) {
      void load(account);
      if (!thresholdInput.value) setKind(kind.value);
      if (pushSupported) void isPushEnabled().then((on) => (pushOn.value = on));
    }
  },
);

async function togglePush() {
  if (!props.account) return;
  pushBusy.value = true;
  try {
    if (pushOn.value) {
      await disablePush(props.account);
      pushOn.value = false;
      toast.success(t('alertPushDisabled'));
    } else {
      const ok = await enablePush(props.account);
      pushOn.value = ok;
      if (ok) toast.success(t('alertPushEnabled'));
      else toast.error(t('alertPushFailed'));
    }
  } finally {
    pushBusy.value = false;
  }
}

async function submit() {
  if (!props.account || parsedThreshold.value <= 0) return;
  creating.value = true;
  try {
    const created = await create({
      wallet: props.account,
      tokenAddress: props.token,
      chainId: props.chainId,
      kind: kind.value,
      direction: direction.value,
      threshold: parsedThreshold.value,
    });
    if (created) {
      toast.success(t('alertCreated'));
      thresholdInput.value = '';
    }
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    creating.value = false;
  }
}

async function removeAlert(id: string) {
  if (!props.account) return;
  try {
    await remove(id, props.account);
  } catch (e) {
    toast.error((e as Error).message);
  }
}
</script>
