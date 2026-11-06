<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="w-[calc(100vw-2rem)] sm:max-w-md bg-card border-border text-foreground transition-all duration-200"
    >
      <DialogHeader>
        <div class="flex items-center gap-2 text-foreground mb-1">
          <Users class="w-5 h-5" />
          <DialogTitle>{{ t('communityTakeover') }}</DialogTitle>
        </div>
        <DialogDescription class="text-xs text-muted-foreground">
          {{ t('ctoModalDescription') }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2 font-sans text-xs">
        <div class="space-y-1.5">
          <Label for="token-addr" class="text-xs font-medium">{{ t('targetTokenAddress') }}</Label>
          <Input
            id="token-addr"
            :model-value="tokenAddress"
            readonly
            disabled
            class="text-xs text-muted-foreground"
          />
        </div>

        <div v-if="stateLoading" class="flex items-center gap-2 text-muted-foreground py-2">
          <Loader2 class="w-4 h-4 animate-spin" />
          {{ t('ctoLoadingState') }}
        </div>

        <template v-else-if="state && ui">
          <!-- Lock confirmation (irreversible) -->
          <div
            v-if="confirmingLock"
            class="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2"
          >
            <div class="flex items-center gap-1.5 font-semibold text-destructive">
              <AlertTriangle class="w-4 h-4" />
              {{ t('ctoLockConfirmTitle') }}
            </div>
            <p class="text-muted-foreground leading-relaxed">
              {{ t('ctoLockConfirmBody', { recipient: state.recipient }) }}
            </p>
            <p v-if="ui.hasPending" class="text-muted-foreground leading-relaxed">
              {{ t('ctoLockDropsPending') }}
            </p>
          </div>

          <template v-else>
            <!-- Current state -->
            <div class="rounded-lg border border-border p-3 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <span class="text-muted-foreground">{{ t('ctoCurrentRecipient') }}</span>
                <span class="font-mono text-foreground break-all text-right">
                  {{ shortenAddress(state.recipient, 6, 4) }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" class="text-xs h-5 px-1.5 border-border">
                  {{ ui.redirected ? t('ctoStatusCommunity') : t('ctoStatusCreator') }}
                </Badge>
                <Badge v-if="state.locked" variant="default" class="text-xs h-5 px-1.5 gap-1">
                  <Lock class="w-3 h-3" />
                  {{ t('ctoStatusLocked') }}
                </Badge>
                <Badge
                  v-else-if="!state.lockSupported"
                  variant="outline"
                  class="text-xs h-5 px-1.5 border-border text-muted-foreground"
                  :title="t('ctoLockUnsupported')"
                >
                  {{ t('ctoLockUnsupportedShort') }}
                </Badge>
              </div>
              <p v-if="state.locked" class="text-muted-foreground leading-relaxed">
                {{ t('ctoLockedHint') }}
              </p>
            </div>

            <!-- Pending proposal -->
            <div
              v-if="ui.hasPending && state.pending"
              class="rounded-lg border border-border p-3 space-y-2"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="text-muted-foreground">{{ t('ctoPendingRecipient') }}</span>
                <span class="font-mono text-foreground break-all text-right">
                  {{ shortenAddress(state.pending, 6, 4) }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Clock class="w-3.5 h-3.5" />
                <span v-if="ui.secondsLeft > 0">
                  {{ t('ctoAcceptableIn', { time: formatCountdown(ui.secondsLeft) }) }}
                </span>
                <span v-else class="text-foreground font-semibold">{{
                  t('ctoAcceptableNow')
                }}</span>
              </div>
              <div class="flex gap-2 flex-wrap">
                <Button
                  v-if="ui.showAccept"
                  size="sm"
                  class="cursor-pointer"
                  :disabled="isBusy || !ui.canAccept"
                  @click="emit('accept')"
                >
                  <Loader2 v-if="busy === 'accept'" class="w-3.5 h-3.5 mr-1 animate-spin" />
                  {{ t('ctoAccept') }}
                </Button>
                <Button
                  v-if="ui.canCancel"
                  variant="outline"
                  size="sm"
                  class="cursor-pointer"
                  :disabled="isBusy"
                  @click="emit('cancel')"
                >
                  <Loader2 v-if="busy === 'cancel'" class="w-3.5 h-3.5 mr-1 animate-spin" />
                  {{ t('ctoCancelPending') }}
                </Button>
              </div>
            </div>

            <!-- Propose -->
            <div v-if="ui.canPropose" class="space-y-1.5">
              <Label for="new-recipient" class="text-xs font-medium">{{
                t('newCommunityRecipient')
              }}</Label>
              <div class="flex gap-2">
                <Input
                  id="new-recipient"
                  v-model="newRecipientAddress"
                  placeholder="0x..."
                  class="text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  class="cursor-pointer shrink-0"
                  :disabled="isBusy || !isAddress(newRecipientAddress.trim())"
                  @click="emit('propose', newRecipientAddress.trim() as `0x${string}`)"
                >
                  <Loader2 v-if="busy === 'propose'" class="w-3.5 h-3.5 mr-1 animate-spin" />
                  {{ t('ctoPropose') }}
                </Button>
              </div>
              <p class="text-muted-foreground leading-relaxed">
                {{ ui.hasPending ? t('ctoProposeReplaces') : t('ctoProposeHint') }}
              </p>
            </div>

            <p v-else-if="!ui.isCreator && !ui.showAccept" class="text-muted-foreground">
              {{ t('ctoOnlyCreator') }}
            </p>
          </template>
        </template>

        <!-- Inline CTO Error -->
        <div
          v-if="error"
          class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 flex items-start gap-1.5"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span class="break-all">{{ error }}</span>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <template v-if="confirmingLock">
          <Button
            variant="outline"
            size="sm"
            class="cursor-pointer"
            :disabled="isBusy"
            @click="confirmingLock = false"
          >
            {{ t('ctoBack') }}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="cursor-pointer"
            :disabled="isBusy"
            @click="emit('lock')"
          >
            <Loader2 v-if="busy === 'lock'" class="w-3.5 h-3.5 mr-1 animate-spin" />
            <Lock v-else class="w-3.5 h-3.5 mr-1" />
            {{ t('ctoLockConfirm') }}
          </Button>
        </template>
        <template v-else>
          <Button
            v-if="ui?.canLock"
            variant="outline"
            size="sm"
            class="cursor-pointer sm:mr-auto"
            :disabled="isBusy"
            @click="confirmingLock = true"
          >
            <Lock class="w-3.5 h-3.5 mr-1" />
            {{ t('ctoLockPermanently') }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="cursor-pointer"
            @click="emit('update:open', false)"
          >
            {{ t('ctoClose') }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { isAddress } from '@goton/shared-types';
import { computed, ref, watch } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import { Users, AlertCircle, AlertTriangle, Clock, Loader2, Lock } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { shortenAddress } from '@/lib/utils';
import {
  formatCountdown,
  redirectUiState,
  type RedirectAction,
  type RedirectState,
} from '@/lib/cto-redirect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const props = defineProps<{
  open: boolean;
  tokenAddress: string;
  account: string | null;
  state: RedirectState | null;
  stateLoading: boolean;
  /** The action whose transaction is in flight, if any. */
  busy: RedirectAction | null;
  error: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'propose', recipient: `0x${string}`): void;
  (e: 'accept'): void;
  (e: 'cancel'): void;
  (e: 'lock'): void;
}>();

const newRecipientAddress = ref('');
const confirmingLock = ref(false);

// Ticks once a second only while the dialog is open, for the timelock countdown.
const nowMs = ref(Date.now());
const { pause, resume } = useIntervalFn(() => (nowMs.value = Date.now()), 1000, {
  immediate: false,
});

const isBusy = computed(() => props.busy !== null);
const ui = computed(() =>
  props.state ? redirectUiState(props.state, props.account, nowMs.value / 1000) : null,
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      nowMs.value = Date.now();
      resume();
    } else {
      pause();
      newRecipientAddress.value = '';
      confirmingLock.value = false;
    }
  },
  { immediate: true },
);

// A new on-chain state (after a transaction) resets the form and the lock confirmation.
watch(
  () => props.state,
  () => {
    newRecipientAddress.value = '';
    confirmingLock.value = false;
  },
);
</script>
