<template>
  <Dialog
    :open="isOpen"
    @update:open="
      (val: boolean) => {
        if (!loading) $emit('close');
      }
    "
  >
    <DialogContent class="max-w-md w-full bg-card border border-border shadow-2xl rounded-2xl p-6">
      <DialogHeader>
        <DialogTitle class="text-lg font-bold text-foreground flex items-center gap-2">
          <Rocket class="w-5 h-5 text-foreground" />
          <span>{{ t('launchingModalTitle') }}</span>
        </DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          {{ tokenName || 'Token' }} ({{ tokenSymbol || 'SYMBOL' }}) &middot;
          {{ networkName }}
        </DialogDescription>
      </DialogHeader>

      <!-- Stepper Progress -->
      <div class="space-y-3 my-2">
        <!-- Step 1: Wallet Signature -->
        <div
          class="flex items-start gap-3 p-3 rounded-xl transition-colors"
          :class="
            launchStep === 'awaiting_signature'
              ? 'bg-muted border border-border'
              : 'bg-muted/40 border border-transparent'
          "
        >
          <div class="mt-0.5 shrink-0">
            <Loader2
              v-if="launchStep === 'awaiting_signature'"
              class="w-5 h-5 text-foreground animate-spin"
            />
            <CheckCircle
              v-else-if="['broadcasting', 'confirming', 'indexing', 'success'].includes(launchStep)"
              class="w-5 h-5 text-foreground"
            />
            <Clock v-else class="w-5 h-5 text-muted-foreground" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>{{ t('launchStepSign') }}</span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ t('launchStepSignDesc') }}
            </p>
          </div>
        </div>

        <!-- Step 2: Transaction Broadcasted & Block Confirmation -->
        <div
          class="flex items-start gap-3 p-3 rounded-xl transition-colors"
          :class="
            ['broadcasting', 'confirming'].includes(launchStep)
              ? 'bg-muted border border-border'
              : 'bg-muted/40 border border-transparent'
          "
        >
          <div class="mt-0.5 shrink-0">
            <Loader2
              v-if="['broadcasting', 'confirming'].includes(launchStep)"
              class="w-5 h-5 text-foreground animate-spin"
            />
            <CheckCircle
              v-else-if="['indexing', 'success'].includes(launchStep)"
              class="w-5 h-5 text-foreground"
            />
            <AlertCircle
              v-else-if="launchStep === 'error' && launchTxHash"
              class="w-5 h-5 text-destructive"
            />
            <Clock v-else class="w-5 h-5 text-muted-foreground" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>{{ t('launchStepConfirm') }}</span>
              <span
                v-if="['broadcasting', 'confirming'].includes(launchStep)"
                class="text-[10px] text-foreground animate-pulse font-mono"
              >
                Confirming...
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ t('launchStepConfirmDesc') }}
            </p>
            <!-- Tx Hash link -->
            <div v-if="launchTxHash" class="mt-2 flex items-center gap-2">
              <a
                v-if="txExplorerUrl"
                :href="txExplorerUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground hover:opacity-80 text-xs font-mono transition-colors"
              >
                <span>Tx: {{ formatHash(launchTxHash) }}</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <!-- Step 3: Protocol Finalization -->
        <div
          class="flex items-start gap-3 p-3 rounded-xl transition-colors"
          :class="
            launchStep === 'indexing'
              ? 'bg-muted border border-border'
              : 'bg-muted/40 border border-transparent'
          "
        >
          <div class="mt-0.5 shrink-0">
            <Loader2
              v-if="launchStep === 'indexing'"
              class="w-5 h-5 text-foreground animate-spin"
            />
            <CheckCircle v-else-if="launchStep === 'success'" class="w-5 h-5 text-foreground" />
            <Clock v-else class="w-5 h-5 text-muted-foreground" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-foreground">
              {{ t('launchStepIndexing') }}
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ t('launchStepIndexingDesc') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Success State Details -->
      <div
        v-if="launchStep === 'success'"
        class="mt-4 p-4 rounded-xl bg-muted border border-border text-center"
      >
        <CheckCircle class="w-10 h-10 text-foreground mx-auto mb-2" />
        <h4 class="text-sm font-bold text-foreground">
          {{ t('launchSuccessTitle') }}
        </h4>
        <p class="text-xs text-muted-foreground mt-1">
          {{ t('launchSuccessDesc') }}
        </p>
        <div v-if="launchTokenAddress" class="mt-3 flex items-center justify-center gap-2">
          <span
            class="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded border border-border"
          >
            {{ formatHash(launchTokenAddress) }}
          </span>
          <a
            v-if="tokenExplorerUrl"
            :href="tokenExplorerUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-foreground hover:underline font-mono"
          >
            <span>{{ t('viewOnExplorer') }}</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>
      </div>

      <!-- Confirming State Details (shows Check Status button if confirmation takes time) -->
      <div
        v-if="launchStep === 'confirming' && launchTxHash"
        class="mt-4 p-4 rounded-xl bg-muted border border-border"
      >
        <div class="flex items-start gap-2.5">
          <Loader2 class="w-5 h-5 text-primary shrink-0 mt-0.5 animate-spin" />
          <div class="flex-1 min-w-0 text-xs">
            <h5 class="font-bold text-foreground">Confirming Transaction on Chain</h5>
            <p class="text-muted-foreground mt-1 break-words leading-relaxed">
              Transaction broadcasted to network. Waiting for block inclusion...
            </p>
            <div class="mt-3 flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                class="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                :disabled="isCheckingStatus"
                @click="$emit('checkStatus')"
              >
                <Loader2 v-if="isCheckingStatus" class="w-3.5 h-3.5 animate-spin" />
                <RefreshCw v-else class="w-3.5 h-3.5" />
                <span>{{
                  isCheckingStatus ? 'Checking confirmation...' : 'Check Confirmation'
                }}</span>
              </Button>

              <a
                v-if="txExplorerUrl"
                :href="txExplorerUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground font-medium transition-colors border border-border h-8 text-xs"
              >
                <span>{{ t('viewOnExplorer') }}</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State Details -->
      <div v-if="launchStep === 'error'" class="mt-4 p-4 rounded-xl bg-muted border border-border">
        <div class="flex items-start gap-2.5">
          <AlertCircle class="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0 text-xs">
            <h5 class="font-bold text-foreground">{{ t('launchFailedTitle') }}</h5>
            <p class="text-muted-foreground mt-1 break-words leading-relaxed">
              {{ error || t('launchFailedDesc') }}
            </p>
            <div v-if="launchTxHash" class="mt-3 flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                class="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                :disabled="isCheckingStatus"
                @click="$emit('checkStatus')"
              >
                <Loader2 v-if="isCheckingStatus" class="w-3.5 h-3.5 animate-spin" />
                <RefreshCw v-else class="w-3.5 h-3.5" />
                <span>{{
                  isCheckingStatus ? 'Checking confirmation...' : 'Check Confirmation Again'
                }}</span>
              </Button>

              <a
                v-if="txExplorerUrl"
                :href="txExplorerUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground font-medium transition-colors border border-border h-8 text-xs"
              >
                <span>{{ t('viewOnExplorer') }}</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="mt-6 flex items-center justify-end gap-3">
        <Button
          v-if="launchStep === 'error' || launchStep === 'confirming'"
          variant="outline"
          size="sm"
          @click="$emit('close')"
          class="h-9 px-4 text-xs font-medium cursor-pointer"
        >
          {{ t('closeModal') }}
        </Button>
        <Button
          v-if="launchStep === 'success'"
          size="sm"
          @click="$emit('trade')"
          class="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5"
        >
          <span>{{ t('tradeToken') }}</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Rocket,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  ArrowRight,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';

const { t } = useI18n();

interface Props {
  isOpen: boolean;
  loading: boolean;
  tokenName?: string;
  tokenSymbol?: string;
  networkName?: string;
  launchStep: string;
  launchTxHash?: string | null;
  launchTokenAddress?: string | null;
  txExplorerUrl?: string;
  tokenExplorerUrl?: string;
  error?: string | null;
  isCheckingStatus?: boolean;
}

withDefaults(defineProps<Props>(), {
  tokenName: 'Token',
  tokenSymbol: 'SYMBOL',
  networkName: '',
  launchTxHash: null,
  launchTokenAddress: null,
  txExplorerUrl: '',
  tokenExplorerUrl: '',
  error: null,
  isCheckingStatus: false,
});

defineEmits<{
  (e: 'close'): void;
  (e: 'checkStatus'): void;
  (e: 'trade'): void;
}>();

function formatHash(hash: string | null) {
  if (!hash) return '';
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
</script>
