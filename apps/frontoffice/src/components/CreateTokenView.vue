<template>
  <div class="max-w-4xl mx-auto space-y-8 py-2 sm:py-4">
    <div>
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
        {{ t('launchToken') }}
      </h1>
      <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
        {{ t('v2Subtitle') }}
      </p>
    </div>

    <!-- Form container using Shadcn Card -->
    <Card class="p-4 sm:p-8 lg:p-10 border border-border bg-card shadow-sm rounded-3xl">
      <form @submit.prevent="handleLaunch" class="space-y-7">
        <!-- Top Info Section: Image on the side + Name, Ticker, Description -->
        <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          <!-- Token Image Dropzone (Side Column) -->
          <div class="space-y-2 w-full sm:w-48 shrink-0">
            <Label>{{ t('tokenImage') }}</Label>
            <div
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="handleDrop"
              :class="[
                'relative border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden p-3 aspect-square w-full sm:w-48 h-48 group',
                dragOver
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/60 bg-muted/30',
              ]"
              @click="triggerFileInput"
            >
              <input
                ref="fileInputRef"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="hidden"
                @change="handleFileChange"
              />

              <!-- Preview with Trash Icon Button on top right -->
              <template v-if="imagePreview">
                <img
                  :src="imagePreview"
                  alt="Preview"
                  class="w-full h-full object-cover rounded-xl"
                />

                <!-- Trash button on top-right of image using Shadcn Button -->
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  class="absolute top-2 right-2 z-10 w-7 h-7 rounded-full shadow-md cursor-pointer border border-white/20"
                  title="Remove image"
                  @click.stop="clearImage"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </Button>
              </template>

              <!-- Empty Upload Prompt -->
              <div
                v-else
                class="flex flex-col items-center justify-center p-2 text-muted-foreground space-y-1.5"
              >
                <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <UploadCloud class="w-5 h-5 text-muted-foreground" />
                </div>
                <span class="text-xs font-semibold text-foreground">Upload Logo</span>
                <span class="text-xs text-muted-foreground leading-tight"
                  >PNG, JPG, WEBP (Max 5MB)</span
                >
              </div>
            </div>

            <!-- Minimal Uploading Spinner Indicator -->
            <div
              v-if="isUploadingIpfs"
              class="flex items-center gap-1.5 text-xs text-amber-500 pt-0.5"
            >
              <Loader2 class="w-3 h-3 animate-spin shrink-0" />
              <span>{{ t('pinningIpfs') }}</span>
            </div>

            <!-- IPFS Ready Indicator -->
            <div
              v-else-if="form.logo"
              class="flex items-center gap-1.5 text-xs text-emerald-500 pt-0.5"
            >
              <Check class="w-3 h-3 shrink-0" />
              <span>{{ t('ipfsReady') }}</span>
            </div>

            <!-- Image Error -->
            <div
              v-if="imageError"
              class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2"
            >
              {{ imageError }}
            </div>
          </div>

          <!-- Name, Ticker, and Description (Main Columns) -->
          <div class="flex-1 w-full space-y-5">
            <!-- Name & Ticker Row -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-2 sm:col-span-2">
                <Label for="token-name">{{ t('tokenName') }}</Label>
                <Input
                  id="token-name"
                  v-model="form.name"
                  type="text"
                  :placeholder="t('namePlaceholder')"
                  maxlength="60"
                  required
                />
              </div>

              <div class="space-y-2">
                <Label for="token-symbol">{{ t('ticker') }}</Label>
                <Input
                  id="token-symbol"
                  v-model="form.symbol"
                  type="text"
                  :placeholder="t('symbolPlaceholder')"
                  maxlength="10"
                  required
                  class="uppercase"
                />
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-2">
              <Label for="token-description">{{ t('description') }}</Label>
              <Textarea
                id="token-description"
                v-model="form.description"
                :placeholder="t('descriptionPlaceholder')"
                class="min-h-[92px] resize-none"
                :rows="3"
              />
            </div>
          </div>
        </div>

        <!-- Social Links (X, Telegram, Website) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 pt-1">
          <div class="space-y-2">
            <Input
              id="token-x"
              v-model="form.twitter"
              type="text"
              placeholder="https://x.com/yourproject"
              class="text-xs"
            />
          </div>

          <div class="space-y-2">
            <Input
              id="token-tg"
              v-model="form.telegram"
              type="text"
              placeholder="https://t.me/yourproject"
              class="text-xs"
            />
          </div>

          <div class="space-y-2">
            <Input
              id="token-web"
              v-model="form.website"
              type="text"
              placeholder="https://yourproject.com"
              class="text-xs"
            />
          </div>
        </div>

        <!-- Paired Asset (Tied to active network selected in navigation) -->
        <div class="space-y-2 pt-1">
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted-foreground">
              {{ activeNetwork.name }}
            </span>
          </div>

          <div
            id="paired-asset"
            class="w-full flex items-center justify-between px-4 py-3 h-12 rounded-xl border border-border bg-card text-foreground"
          >
            <div class="flex items-center gap-2.5">
              <img
                :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                alt=""
                aria-hidden="true"
                width="22"
                height="22"
                class="w-5.5 h-5.5 rounded-full object-contain shrink-0"
              />
              <span class="font-bold text-sm text-foreground">{{ currencySymbol }}</span>
            </div>
            <span class="text-xs text-muted-foreground"> Locked on {{ activeNetwork.name }} </span>
          </div>

          <p class="text-xs text-muted-foreground">
            {{
              `Graduates once the curve raises ${graduationTargetFormatted} ${currencySymbol} into Uniswap liquidity.`
            }}
          </p>
        </div>

        <!-- Developer buy -->
        <div class="space-y-2 pt-1">
          <div class="flex justify-between items-center text-xs">
            <span class="text-muted-foreground">
              {{ t('boughtInLaunchNotice') }}
            </span>
            <div class="flex items-center gap-1.5 text-muted-foreground">
              <span>Balance:</span>
              <strong class="text-foreground font-semibold">
                {{ isConnected ? `${formattedBalance} ${currencySymbol}` : '—' }}
              </strong>
            </div>
          </div>
          <div class="relative">
            <Input
              id="developer-buy"
              v-model="form.initialBuyEth"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00"
              class="text-sm pr-20"
            />
            <div
              class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none select-none"
            >
              <img
                :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                alt=""
                aria-hidden="true"
                width="16"
                height="16"
                class="w-4 h-4 rounded-full object-contain shrink-0"
              />
              <span class="text-xs font-semibold text-muted-foreground">
                {{ currencySymbol }}
              </span>
            </div>
          </div>
          <p v-if="isArcNetwork" class="text-xs text-sky-400 font-medium">
            Arc Network standard: Launch is free (0 USDC fee). Initial pre-buy of at least 4.50 USDC
            is recommended to seed initial liquidity.
          </p>

          <!-- Quick percentage selectors for initial buy -->
          <div
            v-if="isConnected && Number(formattedBalance) > 0"
            class="flex items-center gap-1.5 pt-0.5"
          >
            <button
              v-for="pct in [10, 25, 50, 75]"
              :key="pct"
              type="button"
              class="px-2 py-0.5 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              @click="setInitialBuyPercentage(pct)"
            >
              {{ pct }}%
            </button>
            <button
              type="button"
              class="px-2 py-0.5 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted text-primary font-bold transition cursor-pointer"
              @click="setInitialBuyMax"
            >
              MAX
            </button>
          </div>

          <!-- Insufficient Balance Warning -->
          <div
            v-if="isConnected && isInsufficientBalance"
            class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2"
          >
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>
              Insufficient balance for launch fee + initial buy (Need ~{{ totalDueDisplay }}
              {{ currencySymbol }}, Have {{ formattedBalance }} {{ currencySymbol }}).
            </span>
          </div>
        </div>

        <!-- Advanced Accordion Component -->
        <CreateTokenAdvancedSection
          v-model:open="advancedOpen"
          v-model:creator-wallet="form.creatorWallet"
          v-model:buy-tax="form.buyTax"
          v-model:sell-tax="form.sellTax"
          v-model:revenue-split="revenueSplit"
          :account="account"
        />

        <!-- Form Footer Rate & Submit Button -->
        <div class="pt-6 border-t border-border space-y-4">
          <!-- Launch Cost Summary Breakdown -->
          <div class="rounded-2xl border border-border bg-black p-4 space-y-3 text-xs">
            <div class="flex items-center justify-between text-muted-foreground">
              <span>{{ t('platformCreationFee') }}</span>
              <span class="font-bold text-foreground flex items-center gap-1.5">
                <img
                  :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                  alt=""
                  aria-hidden="true"
                  width="16"
                  height="16"
                  class="w-4 h-4 rounded-full object-contain shrink-0"
                />
                {{
                  isArcNetwork && Number(launchFeeFormatted) === 0
                    ? 'Free (0 USDC)'
                    : `${launchFeeFormatted} ${currencySymbol}`
                }}
              </span>
            </div>

            <div class="flex items-center justify-between text-muted-foreground">
              <span>{{ t('developerBuy') }}</span>
              <span class="font-semibold text-foreground flex items-center gap-1.5">
                <img
                  :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                  alt=""
                  aria-hidden="true"
                  width="16"
                  height="16"
                  class="w-4 h-4 rounded-full object-contain shrink-0"
                />
                {{
                  form.initialBuyEth
                    ? Number(form.initialBuyEth).toFixed(currencySymbol === 'USDC' ? 2 : 4)
                    : (0).toFixed(currencySymbol === 'USDC' ? 2 : 4)
                }}
                {{ currencySymbol }}
              </span>
            </div>

            <div class="pt-3 border-t border-border flex items-center justify-between">
              <span class="font-bold text-foreground uppercase tracking-wider text-xs">
                {{ t('totalDue') }}
              </span>
              <span class="text-sm font-bold text-foreground flex items-center gap-1.5">
                <img
                  :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                  alt=""
                  aria-hidden="true"
                  width="18"
                  height="18"
                  class="w-4.5 h-4.5 rounded-full object-contain shrink-0"
                />
                {{ totalPairDue }}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            :disabled="
              loading ||
              isUploadingIpfs ||
              (isConnected &&
                isCorrectNetwork &&
                (!form.name.trim() || !form.symbol.trim() || (hasTax && totalSplit !== 100)))
            "
            class="w-full font-bold py-3.5 text-base h-12 rounded-xl shadow-md cursor-pointer transition active:scale-[0.99]"
            size="lg"
          >
            <Loader2 v-if="loading || isUploadingIpfs" class="w-4 h-4 mr-2 animate-spin" />
            {{
              isUploadingIpfs
                ? t('pinningIpfs')
                : loading
                  ? t('launchTokenBtn') + '...'
                  : !isConnected
                    ? t('connectWallet')
                    : !isCorrectNetwork
                      ? `Switch to ${activeNetwork.name}`
                      : hasTax && totalSplit !== 100
                        ? `Allocation must total 100% (${totalSplit}%)`
                        : `${t('launchTokenBtn')} (${totalPairDue})`
            }}
          </Button>

          <div
            v-if="error"
            class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <span>{{ error }}</span>
          </div>
        </div>
      </form>
    </Card>

    <!-- Step-by-Step Launch Progress Modal Component -->
    <LaunchProgressModal
      :is-open="isModalOpen"
      :loading="loading"
      :token-name="form.name"
      :token-symbol="form.symbol"
      :network-name="activeNetwork.name"
      :launch-step="launchStep"
      :launch-tx-hash="launchTxHash"
      :launch-token-address="launchTokenAddress"
      :tx-explorer-url="txExplorerUrl"
      :token-explorer-url="tokenExplorerUrl"
      :error="error"
      :is-checking-status="isCheckingStatus"
      @close="closeModal"
      @check-status="handleCheckStatus"
      @trade="goToTrade"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { AlertCircle, UploadCloud, Loader2, Check, Trash2 } from 'lucide-vue-next';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useWallet } from '../composables/useWallet';
import { uploadFile } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';
import { toast } from '@/components/ui/sonner';
import {
  type RevenueSplit,
  calculateTotalSplit,
  calculateLaunchTotalDue,
  getChainMathConfig,
} from '@goton/math-sdk';
import { CreateTokenAdvancedSection, LaunchProgressModal } from './create';

const { t } = useI18n();
const emit = defineEmits<{
  (e: 'tokenCreated', address: string): void;
}>();

const {
  launchToken,
  loading,
  error,
  launchStep,
  launchTxHash,
  launchTokenAddress,
  resetLaunchState,
  checkPendingTransaction,
  retryRevenueSplit,
} = useLaunchpad();
const {
  isConnected,
  account,
  activeNetwork,
  formattedBalance,
  balanceWei,
  updateBalance,
  switchOrAddNetwork,
  isCorrectNetwork,
  openWallet,
} = useWallet();

onMounted(() => {
  if (account.value) {
    updateBalance(undefined, activeNetwork.value.chainId, true);
  }
});

watch(
  () => [account.value, activeNetwork.value.chainId],
  () => {
    if (account.value) {
      updateBalance(undefined, activeNetwork.value.chainId, true);
    }
  },
);

const isInsufficientBalance = computed(() => {
  if (!isConnected.value) return false;
  const launchFeeNum = Number(activeNetwork.value.launchConfig.launchFeeWei) / 1e18;
  const buyNum = parseFloat(form.value.initialBuyEth || '0') || 0;
  const totalNeeded = launchFeeNum + buyNum;
  const userBal = parseFloat(formattedBalance.value) || 0;
  return totalNeeded > userBal;
});

const totalDueDisplay = computed(() => {
  const launchFeeNum = Number(activeNetwork.value.launchConfig.launchFeeWei) / 1e18;
  const buyNum = parseFloat(form.value.initialBuyEth || '0') || 0;
  return (launchFeeNum + buyNum).toFixed(currencySymbol.value === 'USDC' ? 2 : 4);
});

function setInitialBuyPercentage(pct: number) {
  const userBal = parseFloat(formattedBalance.value) || 0;
  const launchFeeNum = Number(activeNetwork.value.launchConfig.launchFeeWei) / 1e18;
  const gasBuffer = currencySymbol.value === 'USDC' ? 0.05 : 0.005;
  const availableForBuy = Math.max(0, userBal - launchFeeNum - gasBuffer);
  const amount = availableForBuy * (pct / 100);
  form.value.initialBuyEth =
    amount > 0 ? amount.toFixed(currencySymbol.value === 'USDC' ? 2 : 4) : '';
}

function setInitialBuyMax() {
  setInitialBuyPercentage(100);
}

const isModalOpen = ref(false);

const graduationTargetFormatted = computed(() => {
  const val = Number(activeNetwork.value.launchConfig.graduationThresholdWei) / 1e18;
  return val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(1);
});

const txExplorerUrl = computed(() => {
  if (!launchTxHash.value) return '';
  const base = activeNetwork.value.blockExplorer.replace(/\/$/, '');
  return `${base}/tx/${launchTxHash.value}`;
});

const tokenExplorerUrl = computed(() => {
  if (!launchTokenAddress.value) return '';
  const base = activeNetwork.value.blockExplorer.replace(/\/$/, '');
  return `${base}/token/${launchTokenAddress.value}`;
});

function formatHash(hash: string | null) {
  if (!hash) return '';
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

const isCheckingStatus = ref(false);

async function handleCheckStatus() {
  if (!launchTxHash.value) return;
  isCheckingStatus.value = true;
  try {
    const res = await checkPendingTransaction();
    if (res) {
      emit('tokenCreated', res.tokenAddress);
    }
  } finally {
    isCheckingStatus.value = false;
  }
}

let autoCheckTimer: ReturnType<typeof setInterval> | null = null;

watch(launchStep, (newStep) => {
  if (autoCheckTimer) {
    clearInterval(autoCheckTimer);
    autoCheckTimer = null;
  }

  // If stuck in confirming or error with a valid transaction hash, poll in background
  if ((newStep === 'confirming' || newStep === 'error') && launchTxHash.value) {
    let attempts = 0;
    autoCheckTimer = setInterval(async () => {
      attempts++;
      if (attempts >= 12 || launchStep.value === 'success') {
        if (autoCheckTimer) clearInterval(autoCheckTimer);
        autoCheckTimer = null;
        return;
      }
      const res = await checkPendingTransaction();
      if (res) {
        emit('tokenCreated', res.tokenAddress);
      }
    }, 2500);
  }
});

function closeModal() {
  isModalOpen.value = false;
  resetLaunchState();
}

function goToTrade() {
  if (launchTokenAddress.value) {
    emit('tokenCreated', launchTokenAddress.value);
    isModalOpen.value = false;
  }
}

// In-pool v4 chains (Arc) fix the tax at launch and require a creator prebuy.
const isArcNetwork = computed(
  () => getChainMathConfig(activeNetwork.value.chainId)?.model === 'v4-in-pool',
);
const minPrebuy = computed(
  () => Number(activeNetwork.value.launchConfigV2?.minPrebuyWei ?? 0n) / 1e18,
);
const currencySymbol = computed(() => activeNetwork.value.nativeCurrency.symbol);
const launchFeeFormatted = computed(() => {
  const feeWei = activeNetwork.value.launchConfig.launchFeeWei;
  // All EVM native msg.value (including Arc USDC gas) use 18 decimals per Circle Arc specs
  const val = Number(feeWei) / 10 ** 18;
  return val < 0.001 ? val.toFixed(4) : val.toFixed(2);
});
const totalPairDue = computed(() => {
  const buyAmount = parseFloat(form.value.initialBuyEth) || 0;
  const fee = parseFloat(launchFeeFormatted.value) || 0;
  const total = calculateLaunchTotalDue(fee, buyAmount);
  return `${total.toFixed(currencySymbol.value === 'USDC' ? 2 : 4)} ${currencySymbol.value}`;
});

const revenueSplit = ref<RevenueSplit>({
  creator: 50,
  buyback: 0,
  holders: 50,
  growth: 0,
});

const totalSplit = computed(() => calculateTotalSplit(revenueSplit.value));

const hasTax = computed(() => {
  const buy = parseFloat(form.value.buyTax || '0');
  const sell = parseFloat(form.value.sellTax || '0');
  return buy > 0 || sell > 0;
});

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');
const imagePreview = ref('');
const dragOver = ref(false);
const isUploadingIpfs = ref(false);
const imageError = ref('');
const advancedOpen = ref(false);
function clearImage() {
  selectedFileName.value = '';
  imagePreview.value = '';
  pendingImageFile.value = null;
  form.value.logo = '';
  imageError.value = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

const form = ref({
  name: '',
  symbol: '',
  description: '',
  logo: '',
  website: '',
  twitter: '',
  telegram: '',
  initialBuyEth: '',
  buyTax: '0',
  sellTax: '0',
  creatorWallet: '',
});
const pendingImageFile = ref<File | null>(null);

function triggerFileInput() {
  fileInputRef.value?.click();
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

  selectedFileName.value = file.name;
  try {
    // Compress and convert to WebP preview locally — IPFS upload is deferred until user confirms launch
    const processed = await compressAndConvertToWebp(file, 512, 0.85);
    imagePreview.value = processed.dataUrl;
    pendingImageFile.value = processed.file;
    form.value.logo = '';
  } catch (err) {
    console.warn('[CreateToken] Image preview processing error:', err);
    imageError.value = 'Failed to process image preview. Please try another file.';
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    processImageFile(file);
  }
}

function handleDrop(event: DragEvent) {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    processImageFile(file);
  }
}

async function handleLaunch() {
  if (!isConnected.value) {
    openWallet();
    return;
  }
  if (!isCorrectNetwork.value) {
    await switchOrAddNetwork(activeNetwork.value);
    return;
  }
  if ((parseFloat(String(form.value.initialBuyEth)) || 0) < minPrebuy.value) {
    toast.error(
      `${activeNetwork.value.name} requires an initial pre-buy of at least ${minPrebuy.value} ${currencySymbol.value}.`,
    );
    return;
  }
  if (
    isArcNetwork.value &&
    !(parseFloat(form.value.buyTax || '0') > 0) &&
    !(parseFloat(form.value.sellTax || '0') > 0)
  ) {
    advancedOpen.value = true;
    toast.error(
      `${activeNetwork.value.name} tokens need a buy or sell tax above 0% (fixed forever).`,
    );
    return;
  }
  if (totalSplit.value !== 100) {
    advancedOpen.value = true;
    toast.error(
      `Revenue split allocation must equal 100% (currently ${totalSplit.value}%). Please auto-balance or adjust.`,
    );
    return;
  }

  // Upload image to IPFS only when user clicks launch and confirms payment
  if (pendingImageFile.value && !form.value.logo) {
    try {
      isUploadingIpfs.value = true;
      const data = await uploadFile<{
        success: boolean;
        data?: { cid?: string; uri?: string; url?: string };
        error?: { message?: string };
      }>('/api/ipfs/upload', pendingImageFile.value);
      const logoUri =
        (data.data?.cid ? `ipfs://${data.data.cid}` : '') || data.data?.uri || data.data?.url || '';
      if (data.success && logoUri) {
        form.value.logo = logoUri;
        imageError.value = '';
      } else {
        imageError.value = data?.error?.message || 'Failed to upload image to IPFS.';
        return;
      }
    } catch (err) {
      console.warn('[CreateToken] IPFS upload error:', err);
      imageError.value = 'Failed to upload image to IPFS. Please try again.';
      return;
    } finally {
      isUploadingIpfs.value = false;
    }
  }
  isModalOpen.value = true;
  const result = await launchToken({
    name: form.value.name.trim(),
    symbol: form.value.symbol.trim().toUpperCase(),
    description: form.value.description.trim(),
    logo: form.value.logo.trim(),
    socials: {
      website: form.value.website.trim(),
      twitter: form.value.twitter.trim(),
      telegram: form.value.telegram.trim(),
    },
    initialBuyAmountEth: String(form.value.initialBuyEth || '0').trim(),
    buyTaxPercent: parseFloat(form.value.buyTax || '0'),
    sellTaxPercent: parseFloat(form.value.sellTax || '0'),
    creatorTaxWallet: form.value.creatorWallet.trim() || undefined,
    revenueSplit: { ...revenueSplit.value },
  });

  if (result) {
    warnIfSettingsMissing(result, activeNetwork.value.chainId, { ...revenueSplit.value });
    emit('tokenCreated', result.tokenAddress);
  }
}

/**
 * On Robinhood Chain the creator tax and the revenue split are separate transactions after the
 * launch. If one did not land (rejected signature, or a third party bought first), say so instead
 * of letting the creator believe it is active, and offer a retry while it is still possible.
 */
function warnIfSettingsMissing(
  result: { tokenAddress: `0x${string}`; taxApplied: boolean; splitApplied: boolean },
  chainId: number,
  split: typeof revenueSplit.value,
) {
  if (!result.splitApplied) {
    toast.warning('Revenue split was not applied', {
      description:
        'Fees will use the default split (all to the creator) unless you retry before the first buy from another wallet.',
      duration: Infinity,
      action: {
        label: 'Retry',
        onClick: async () => {
          if (await retryRevenueSplit(result.tokenAddress, split, chainId)) {
            toast.success('Revenue split applied');
          } else {
            toast.error('Revenue split could not be applied. Trading may have started already.');
          }
        },
      },
    });
  }
  if (!result.taxApplied) {
    toast.warning('Creator tax was not applied', {
      description:
        'Your token trades without the tax you set. You can set it from the token page until the first buy from another wallet.',
      duration: 15_000,
    });
  }
}
</script>
