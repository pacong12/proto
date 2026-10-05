<template>
  <div class="space-y-7">
    <!-- Wallet connection -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/40 border border-border"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Wallet class="w-4 h-4 text-foreground" />
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-foreground">{{ SOLANA_NETWORK.name }}</p>
          <p class="text-xs font-mono text-muted-foreground truncate">
            {{ isConnected ? formattedAddress : t('solanaSelectWalletDesc') }}
          </p>
        </div>
      </div>
      <Button
        v-if="isConnected"
        type="button"
        variant="outline"
        size="sm"
        class="cursor-pointer"
        @click="disconnect"
      >
        <LogOut class="w-3.5 h-3.5 mr-1.5" />
        {{ t('solanaDisconnect') }}
      </Button>
      <Button
        v-else
        type="button"
        size="sm"
        class="cursor-pointer"
        :disabled="connecting"
        @click="walletPickerOpen = true"
      >
        <Loader2 v-if="connecting" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
        {{ t('solanaConnectWallet') }}
      </Button>
    </div>

    <form class="space-y-7" @submit.prevent="handleLaunch">
      <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
        <!-- Logo -->
        <div class="space-y-2 w-full sm:w-48 shrink-0">
          <Label>{{ t('tokenImage') }}</Label>
          <div
            :class="[
              'relative border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden p-3 aspect-square w-full sm:w-48 h-48',
              dragOver
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/60 bg-muted/30',
            ]"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            @click="fileInputRef?.click()"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="handleFileChange"
            />
            <template v-if="imagePreview">
              <img
                :src="imagePreview"
                alt="Preview"
                class="w-full h-full object-cover rounded-xl"
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                class="absolute top-2 right-2 z-10 w-7 h-7 rounded-full shadow-md cursor-pointer"
                title="Remove image"
                @click.stop="clearImage"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </Button>
            </template>
            <div
              v-else
              class="flex flex-col items-center justify-center p-2 text-muted-foreground space-y-1.5"
            >
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <UploadCloud class="w-5 h-5" />
              </div>
              <span class="text-xs font-semibold text-foreground">Upload Logo</span>
              <span class="text-[10px] leading-tight">PNG, JPG, WEBP (Max 5MB)</span>
            </div>
          </div>
          <div
            v-if="uploadingImage"
            class="flex items-center gap-1.5 text-[11px] font-mono text-amber-500 pt-0.5"
          >
            <Loader2 class="w-3 h-3 animate-spin shrink-0" />
            <span>{{ t('pinningIpfs') }}</span>
          </div>
          <div
            v-if="imageError"
            class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2"
          >
            {{ imageError }}
          </div>
        </div>

        <!-- Name, ticker, description -->
        <div class="flex-1 w-full space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="space-y-2 sm:col-span-2">
              <Label for="sol-token-name">{{ t('tokenName') }}</Label>
              <Input
                id="sol-token-name"
                v-model="form.name"
                type="text"
                :placeholder="t('namePlaceholder')"
                :maxlength="SOLANA_METADATA_LIMITS.nameMaxLength"
                required
              />
            </div>
            <div class="space-y-2">
              <Label for="sol-token-symbol">{{ t('ticker') }}</Label>
              <Input
                id="sol-token-symbol"
                v-model="form.symbol"
                type="text"
                :placeholder="t('symbolPlaceholder')"
                :maxlength="SOLANA_METADATA_LIMITS.symbolMaxLength"
                required
                class="font-mono uppercase"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="sol-token-description">{{ t('description') }}</Label>
            <Textarea
              id="sol-token-description"
              v-model="form.description"
              :placeholder="t('descriptionPlaceholder')"
              :maxlength="SOLANA_METADATA_LIMITS.descriptionMaxLength"
              class="min-h-[92px] resize-none"
              :rows="3"
            />
          </div>
        </div>
      </div>

      <!-- Socials -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <Input
          v-model="form.twitter"
          type="url"
          placeholder="https://x.com/yourproject"
          class="font-mono text-xs"
        />
        <Input
          v-model="form.telegram"
          type="url"
          placeholder="https://t.me/yourproject"
          class="font-mono text-xs"
        />
        <Input
          v-model="form.website"
          type="url"
          placeholder="https://yourproject.com"
          class="font-mono text-xs"
        />
      </div>

      <!-- Token details -->
      <div class="rounded-2xl border border-border p-4 sm:p-5 space-y-3">
        <h3 class="text-sm font-semibold text-foreground">{{ t('solanaTokenDetails') }}</h3>
        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
          <div>
            <dt class="text-muted-foreground">{{ t('solanaStandard') }}</dt>
            <dd class="font-mono text-foreground mt-0.5">SPL Token-2022</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">{{ t('solanaSupply') }}</dt>
            <dd class="font-mono text-foreground mt-0.5">{{ formattedSupply }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">{{ t('solanaDecimals') }}</dt>
            <dd class="font-mono text-foreground mt-0.5">
              {{ SOLANA_NETWORK.launchConfig.decimals }}
            </dd>
          </div>
          <div>
            <dt class="text-muted-foreground">{{ t('solanaMintAuthority') }}</dt>
            <dd class="text-foreground mt-0.5">{{ t('solanaRevoked') }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">{{ t('solanaFreezeAuthority') }}</dt>
            <dd class="text-foreground mt-0.5">{{ t('solanaNone') }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground flex items-center gap-1">
              {{ t('solanaEstimatedCost') }}
              <InfoTooltip :text="t('solanaCostHint')" />
            </dt>
            <dd class="font-mono text-foreground mt-0.5">~{{ estimatedCostSol }} SOL</dd>
          </div>
        </dl>
      </div>

      <div class="space-y-3">
        <Button
          type="submit"
          size="lg"
          class="w-full font-bold py-3.5 text-base h-12 rounded-xl shadow-md cursor-pointer transition active:scale-[0.99]"
          :disabled="
            loading || uploadingImage || (isConnected && (!form.name.trim() || !form.symbol.trim()))
          "
        >
          <Loader2 v-if="loading || uploadingImage" class="w-4 h-4 mr-2 animate-spin" />
          {{
            uploadingImage
              ? t('pinningIpfs')
              : loading
                ? t('launchTokenBtn') + '...'
                : !isConnected
                  ? t('solanaConnectWallet')
                  : `${t('launchTokenBtn')} (~${estimatedCostSol} SOL)`
          }}
        </Button>
        <div
          v-if="formProblems.length > 0"
          class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ formProblems.join('. ') }}</span>
        </div>
        <p class="text-[11px] text-muted-foreground">{{ t('solanaListingNotice') }}</p>
      </div>
    </form>

    <!-- Wallet picker -->
    <Dialog :open="walletPickerOpen" @update:open="(val: boolean) => (walletPickerOpen = val)">
      <DialogContent
        class="w-[calc(100vw-2rem)] sm:max-w-sm p-6 bg-card border border-border rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle class="text-base font-bold text-foreground">
            {{ t('solanaSelectWallet') }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            {{ t('solanaSelectWalletDesc') }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-2 mt-2">
          <template v-for="option in wallets" :key="option.id">
            <button
              v-if="option.installed"
              type="button"
              class="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted text-sm font-medium text-foreground transition-colors cursor-pointer"
              @click="selectWallet(option.id)"
            >
              <span>{{ option.name }}</span>
              <ArrowRight class="w-4 h-4 text-muted-foreground" />
            </button>
            <a
              v-else
              :href="option.installUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{{ option.name }}</span>
              <span class="text-[11px] flex items-center gap-1">
                {{ t('solanaNotInstalled') }} <ExternalLink class="w-3 h-3" />
              </span>
            </a>
          </template>
        </div>
        <div
          v-if="walletError"
          class="mt-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2"
        >
          {{ walletError }}
        </div>
      </DialogContent>
    </Dialog>

    <!-- Launch progress -->
    <Dialog
      :open="progressOpen"
      @update:open="(val: boolean) => !loading && !val && closeProgress()"
    >
      <DialogContent
        class="w-[calc(100vw-2rem)] sm:max-w-lg p-6 bg-card border border-border rounded-2xl shadow-2xl"
      >
        <DialogHeader class="mb-4">
          <DialogTitle class="text-lg font-bold text-foreground flex items-center gap-2">
            <Rocket class="w-5 h-5" />
            <span>{{ t('launchingModalTitle') }}</span>
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            {{ form.name || 'Token' }} ({{ form.symbol.toUpperCase() || 'SYMBOL' }}) &middot;
            {{ SOLANA_NETWORK.name }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 my-2">
          <div
            v-for="item in progressSteps"
            :key="item.key"
            class="flex items-start gap-3 p-3 rounded-xl transition-colors"
            :class="
              item.state === 'active'
                ? 'bg-muted border border-border'
                : 'bg-muted/40 border border-transparent'
            "
          >
            <div class="mt-0.5 shrink-0">
              <Loader2 v-if="item.state === 'active'" class="w-5 h-5 animate-spin" />
              <CheckCircle v-else-if="item.state === 'done'" class="w-5 h-5 text-foreground" />
              <AlertCircle v-else-if="item.state === 'failed'" class="w-5 h-5 text-destructive" />
              <Clock v-else class="w-5 h-5 text-muted-foreground" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-foreground">{{ item.title }}</div>
              <p class="text-xs text-muted-foreground mt-0.5">{{ item.description }}</p>
              <a
                v-if="item.key === 'confirm' && signature"
                :href="solanaExplorerUrl('tx', signature)"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground hover:opacity-80 text-xs font-mono"
              >
                <span>{{ t('solanaViewTransaction') }}: {{ shortenAddress(signature) }}</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        <div
          v-if="step === 'success' && mintAddress"
          class="mt-4 p-4 rounded-xl bg-muted border border-border text-center"
        >
          <CheckCircle class="w-10 h-10 text-foreground mx-auto mb-2" />
          <h4 class="text-sm font-bold text-foreground">{{ t('launchSuccessTitle') }}</h4>
          <p class="text-xs text-muted-foreground mt-1">{{ t('solanaLaunchSuccessDesc') }}</p>
          <div class="mt-3 flex items-center justify-center gap-2">
            <span
              class="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded border border-border"
            >
              {{ shortenAddress(mintAddress) }}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="w-7 h-7 cursor-pointer"
              title="Copy mint address"
              @click="copyMint"
            >
              <Check v-if="copied" class="w-3.5 h-3.5" />
              <Copy v-else class="w-3.5 h-3.5" />
            </Button>
            <a
              :href="solanaExplorerUrl('token', mintAddress)"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-foreground hover:underline font-mono"
            >
              <span>{{ t('viewOnExplorer') }}</span>
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>

        <div
          v-if="step === 'error' && launchError"
          class="mt-4 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span class="break-words">{{ launchError }}</span>
        </div>

        <div class="mt-5 flex justify-end">
          <Button
            type="button"
            variant="outline"
            class="cursor-pointer"
            :disabled="loading"
            @click="closeProgress"
          >
            {{ t('closeModal') }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Rocket,
  Trash2,
  UploadCloud,
  Wallet,
} from 'lucide-vue-next';
import {
  SOLANA_METADATA_LIMITS,
  SOLANA_NETWORK,
  solanaExplorerUrl,
  validateSolanaTokenDraft,
} from '@proto/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { InfoTooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';
import { shortenAddress } from '@/lib/utils';
import { estimateSolanaLaunchCostLamports } from '../chains/solana/solana-cost';
import type { SolanaWalletOption } from '../chains/solana/solana-wallet';
import { useSolanaWallet } from '../composables/useSolanaWallet';
import { useSolanaLaunch, type SolanaLaunchStep } from '../composables/useSolanaLaunch';

const { t } = useI18n();
const {
  wallets,
  isConnected,
  formattedAddress,
  connecting,
  error: walletError,
  connect,
  disconnect,
  restore,
} = useSolanaWallet();
const {
  step,
  error: launchError,
  signature,
  mintAddress,
  loading,
  launch,
  reset,
} = useSolanaLaunch();

const form = ref({
  name: '',
  symbol: '',
  description: '',
  logo: '',
  website: '',
  twitter: '',
  telegram: '',
});

const walletPickerOpen = ref(false);
const progressOpen = ref(false);
const submitted = ref(false);
const copied = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);
const imagePreview = ref('');
const imageError = ref('');
const uploadingImage = ref(false);
const dragOver = ref(false);

onMounted(() => {
  restore();
});

const formattedSupply = computed(() =>
  Number(SOLANA_NETWORK.launchConfig.supply).toLocaleString('en-US'),
);

const estimatedCostSol = computed(() =>
  (estimateSolanaLaunchCostLamports(form.value.name, form.value.symbol) / 1e9).toFixed(4),
);

const draft = computed(() => ({
  name: form.value.name,
  symbol: form.value.symbol,
  description: form.value.description,
  image: form.value.logo,
  website: form.value.website,
  twitter: form.value.twitter,
  telegram: form.value.telegram,
}));

// Only show validation problems after the first submit attempt.
const formProblems = computed(() => (submitted.value ? validateSolanaTokenDraft(draft.value) : []));

type StepState = 'pending' | 'active' | 'done' | 'failed';
const ORDER: SolanaLaunchStep[] = [
  'validating',
  'uploading_metadata',
  'awaiting_signature',
  'broadcasting',
  'confirming',
  'success',
];
// Remember which step was running when an error happened, so the stepper marks it as failed.
const failedAt = ref<SolanaLaunchStep | null>(null);
watch(
  step,
  (next, previous) => {
    if (next === 'error') failedAt.value = previous;
    else if (next === 'idle' || next === 'validating') failedAt.value = null;
  },
  { flush: 'sync' },
);

function stateFor(steps: SolanaLaunchStep[]): StepState {
  const current = step.value;
  if (current === 'error') {
    return failedAt.value && steps.includes(failedAt.value)
      ? 'failed'
      : ORDER.indexOf(failedAt.value ?? 'idle') > ORDER.indexOf(steps[steps.length - 1])
        ? 'done'
        : 'pending';
  }
  if (steps.includes(current)) return 'active';
  return ORDER.indexOf(current) > ORDER.indexOf(steps[steps.length - 1]) ? 'done' : 'pending';
}

const progressSteps = computed(() => [
  {
    key: 'metadata',
    title: t('solanaStepMetadata'),
    description: t('solanaStepMetadataDesc'),
    state: stateFor(['validating', 'uploading_metadata']),
  },
  {
    key: 'sign',
    title: t('launchStepSign'),
    description: t('launchStepSignDesc'),
    state: stateFor(['awaiting_signature']),
  },
  {
    key: 'confirm',
    title: t('launchStepConfirm'),
    description: t('launchStepConfirmDesc'),
    state: stateFor(['broadcasting', 'confirming']),
  },
]);

async function selectWallet(id: SolanaWalletOption['id']) {
  if (await connect(id)) walletPickerOpen.value = false;
}

function clearImage() {
  imagePreview.value = '';
  imageError.value = '';
  form.value.logo = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

async function processImageFile(file: File) {
  imageError.value = '';
  if (!file.type.startsWith('image/')) {
    imageError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    imageError.value = 'Image file size must be less than 5MB.';
    return;
  }
  uploadingImage.value = true;
  try {
    const processed = await compressAndConvertToWebp(file, 512, 0.85);
    imagePreview.value = processed.dataUrl;
    const body = new FormData();
    body.append('file', processed.file);
    const res = await fetch('/api/ipfs/upload', { method: 'POST', body });
    const data = await res.json();
    form.value.logo = data.success && data.data?.url ? data.data.url : '';
    if (!form.value.logo) imageError.value = 'Logo upload failed. Please try again.';
  } catch {
    form.value.logo = '';
    imageError.value = 'Logo upload failed. Please try again.';
  } finally {
    uploadingImage.value = false;
  }
}

function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) processImageFile(file);
}

function handleDrop(event: DragEvent) {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) processImageFile(file);
}

async function handleLaunch() {
  if (!isConnected.value) {
    walletPickerOpen.value = true;
    return;
  }
  submitted.value = true;
  if (formProblems.value.length > 0) return;

  progressOpen.value = true;
  await launch(draft.value);
}

function closeProgress() {
  progressOpen.value = false;
  if (step.value === 'success') {
    form.value = {
      name: '',
      symbol: '',
      description: '',
      logo: '',
      website: '',
      twitter: '',
      telegram: '',
    };
    clearImage();
    submitted.value = false;
  }
  reset();
}

async function copyMint() {
  if (!mintAddress.value) return;
  try {
    await navigator.clipboard.writeText(mintAddress.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard unavailable; the address is still visible.
  }
}
</script>
