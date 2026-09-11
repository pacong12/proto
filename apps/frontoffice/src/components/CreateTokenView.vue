<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div>
      <div class="flex items-center gap-2">
        <Rocket class="w-6 h-6 text-emerald-400" />
        <h1 class="text-3xl font-bold tracking-tight">{{ t('launchToken') }}</h1>
      </div>
      <p class="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
        {{ selectedVersion === 'v2' ? t('v2Subtitle') : t('v1Subtitle') }}
      </p>
    </div>

    <!-- Form container using Shadcn Card -->
    <Card class="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <!-- Dual Launch Architecture Tabs (v2 / v1) -->
      <div class="mb-6 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl flex">
        <button
          type="button"
          @click="selectedVersion = 'v2'"
          :class="[
            'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2',
            selectedVersion === 'v2'
              ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm'
              : 'text-zinc-500 hover:text-black dark:hover:text-white',
          ]"
        >
          <Rocket class="w-3.5 h-3.5 text-emerald-500" />
          <span>{{ t('v2BondingCurveTab') }}</span>
        </button>
        <button
          type="button"
          @click="selectedVersion = 'v1'"
          :class="[
            'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2',
            selectedVersion === 'v1'
              ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-sm'
              : 'text-zinc-500 hover:text-black dark:hover:text-white',
          ]"
        >
          <Lock class="w-3.5 h-3.5 text-zinc-400" />
          <span>{{ t('v1DirectPoolTab') }}</span>
        </button>
      </div>

      <form @submit.prevent="handleLaunch" class="space-y-5">
        <!-- Name -->
        <div class="space-y-1.5">
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

        <!-- Ticker -->
        <div class="space-y-1.5">
          <Label for="token-symbol">{{ t('ticker') }}</Label>
          <Input
            id="token-symbol"
            v-model="form.symbol"
            type="text"
            :placeholder="t('symbolPlaceholder')"
            maxlength="10"
            required
            class="font-mono uppercase"
          />
        </div>

        <!-- Description -->
        <div class="space-y-1.5">
          <Label for="token-description">{{ t('description') }}</Label>
          <Textarea
            id="token-description"
            v-model="form.description"
            :placeholder="t('descriptionPlaceholder')"
            :rows="3"
          />
        </div>

        <!-- Token image -->
        <div class="space-y-1.5">
          <Label>{{ t('tokenImage') }}</Label>
          <div
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            :class="[
              'relative border-2 border-dashed rounded-xl p-4 transition-all flex flex-col sm:flex-row items-center gap-4 text-left cursor-pointer',
              dragOver
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600',
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

            <!-- Thumbnail / Icon -->
            <div
              class="w-14 h-14 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700"
            >
              <img
                v-if="imagePreview"
                :src="imagePreview"
                alt="Preview"
                class="w-full h-full object-cover"
              />
              <UploadCloud v-else class="w-6 h-6 text-zinc-400" />
            </div>

            <!-- Upload copy & status -->
            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-black dark:text-white">
                  {{ selectedFileName || t('noFileChosen') }}
                </span>
                <Badge
                  v-if="isUploadingIpfs"
                  variant="outline"
                  class="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30 flex items-center gap-1"
                >
                  <Loader2 class="w-3 h-3 animate-spin" />
                  {{ t('pinningIpfs') }}
                </Badge>
                <Badge
                  v-else-if="form.logo"
                  variant="outline"
                  class="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                >
                  {{ t('ipfsReady') }}
                </Badge>
              </div>
              <p class="text-[11px] leading-normal text-zinc-500 dark:text-zinc-400">
                {{ t('chooseImage') }}
              </p>
            </div>

            <Button
              v-if="imagePreview"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400"
              @click.stop="clearImage"
            >
              {{ t('remove') }}
            </Button>
          </div>
        </div>

        <!-- X profile -->
        <div class="space-y-1.5">
          <Label for="token-x">X profile</Label>
          <div class="relative">
            <span class="absolute left-3 top-2 text-xs text-zinc-400 select-none font-mono"
              >x.com/</span
            >
            <Input
              id="token-x"
              v-model="form.twitter"
              type="text"
              :placeholder="t('handlePlaceholder')"
              maxlength="15"
              class="pl-16 font-mono text-xs"
            />
          </div>
        </div>

        <!-- Telegram -->
        <div class="space-y-1.5">
          <Label for="token-tg">Telegram</Label>
          <div class="relative">
            <span class="absolute left-3 top-2 text-xs text-zinc-400 select-none font-mono"
              >t.me/</span
            >
            <Input
              id="token-tg"
              v-model="form.telegram"
              type="text"
              :placeholder="t('communityPlaceholder')"
              maxlength="32"
              class="pl-14 font-mono text-xs"
            />
          </div>
        </div>

        <!-- Paired asset -->
        <div class="space-y-1.5">
          <Label>{{ t('pairedAsset') }}</Label>
          <div
            class="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900"
          >
            <div class="flex items-center gap-2 text-sm font-semibold">
              <div
                class="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs"
              >
                Ξ
              </div>
              <span>ETH</span>
            </div>
            <span class="text-xs text-zinc-500">Robinhood Chain (Native)</span>
          </div>
          <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
            {{ selectedVersion === 'v2' ? t('v2GraduatesHint') : t('v1PairsHint') }}
          </p>
        </div>

        <!-- Developer buy -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-center">
            <Label for="developer-buy">{{ t('developerBuy') }}</Label>
            <span class="text-[11px] text-zinc-500 font-mono">
              {{ t('boughtInLaunchNotice') }}
            </span>
          </div>
          <div class="relative">
            <Input
              id="developer-buy"
              v-model="form.initialBuyEth"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00"
              class="font-mono text-sm pr-16"
            />
            <span class="absolute right-3 top-2.5 text-xs font-semibold text-zinc-400">ETH</span>
          </div>
        </div>

        <!-- Advanced Accordion -->
        <Card
          class="rounded-xl border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-950/30 overflow-hidden p-0"
        >
          <button
            type="button"
            @click="advancedOpen = !advancedOpen"
            class="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold transition hover:bg-zinc-100 dark:hover:bg-zinc-900/50 cursor-pointer"
          >
            <span class="flex items-center gap-2">
              <SlidersHorizontal class="w-3.5 h-3.5 text-zinc-400" />
              {{ t('advanced') }}
            </span>
            <ChevronDown
              class="w-3.5 h-3.5 transition-transform duration-200 opacity-60"
              :class="advancedOpen ? 'rotate-180' : ''"
            />
          </button>

          <div
            v-show="advancedOpen"
            class="px-4 pb-4 pt-1 space-y-4 border-t border-zinc-200 dark:border-zinc-800/60"
          >
            <!-- Holder fee sharing -->
            <div class="space-y-1 pt-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium">{{ t('holderFeeSharing') }}</span>
                <Switch v-model:checked="holderFeeSharing" />
              </div>
              <p class="text-[11px] text-zinc-500">
                {{
                  holderFeeSharing
                    ? 'Creator fees go to token holders pro-rata.'
                    : 'Creator fees go to the creator wallet.'
                }}
              </p>
              <p class="text-[10px] text-zinc-400">
                {{ t('creatorFeeSharingDesc') }}
              </p>
            </div>

            <!-- Creator wallet -->
            <div class="space-y-1">
              <Label for="creator-wallet" class="text-xs font-medium">{{
                t('creatorWallet')
              }}</Label>
              <Input
                id="creator-wallet"
                v-model="form.creatorWallet"
                type="text"
                :placeholder="t('addressPlaceholder')"
                class="font-mono text-xs"
              />
              <p class="text-[10px] text-zinc-400">
                {{ t('creatorWalletDesc') }}
              </p>
            </div>

            <!-- Creator tax -->
            <div class="space-y-1">
              <Label for="creator-tax" class="text-xs font-medium">{{ t('creatorTax') }}</Label>
              <div class="relative">
                <Input
                  id="creator-tax"
                  v-model="form.buyTax"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  placeholder="1"
                  class="font-mono text-xs pr-8"
                />
                <span class="absolute right-3 top-2 text-xs font-semibold text-zinc-400">%</span>
              </div>
              <p class="text-[10px] text-zinc-400">
                Traders pay
                {{
                  (parseFloat(form.buyTax || '0') + (selectedVersion === 'v2' ? 1.0 : 1.0)).toFixed(
                    2,
                  )
                }}% in total, up to 10% of it yours.
              </p>
            </div>

            <!-- Snipe tax exemptions -->
            <div class="space-y-1">
              <Label for="snipe-tax" class="text-xs font-medium">{{ t('snipeExemptions') }}</Label>
              <Input
                id="snipe-tax"
                v-model="snipeExemptionWallet"
                type="text"
                placeholder="0x wallet address"
                class="font-mono text-xs"
              />
              <p class="text-[10px] text-zinc-400">
                Buys in the launch second pay 99%, decaying to zero across 3s. Declare the wallets
                your team opens with.
              </p>
            </div>
          </div>
        </Card>

        <!-- Form Footer Rate & Submit Button -->
        <div class="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{{ t('ethPairDue') }}</span>
            <span class="font-mono">—</span>
          </div>

          <Button
            type="submit"
            :disabled="loading || isUploadingIpfs || !form.name || !form.symbol"
            class="w-full font-bold py-3 text-sm h-11"
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
                    : t('launchTokenBtn')
            }}
          </Button>

          <div
            v-if="error"
            class="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <span>{{ error }}</span>
          </div>
        </div>
      </form>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Rocket,
  Lock,
  AlertCircle,
  UploadCloud,
  ChevronDown,
  SlidersHorizontal,
  Loader2,
} from 'lucide-vue-next';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useWallet } from '../composables/useWallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/i18n';

const { t } = useI18n();
const emit = defineEmits<{
  (e: 'tokenCreated', address: string): void;
}>();

const { launchToken, loading, error } = useLaunchpad();
const { isConnected } = useWallet();

const selectedVersion = ref<'v1' | 'v2'>('v2');
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');
const imagePreview = ref('');
const dragOver = ref(false);
const isUploadingIpfs = ref(false);
const advancedOpen = ref(false);
const holderFeeSharing = ref(false);
const snipeExemptionWallet = ref('');

function clearImage() {
  selectedFileName.value = '';
  imagePreview.value = '';
  form.value.logo = '';
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
  buyTax: '1',
  sellTax: '1',
  creatorWallet: '',
});

function triggerFileInput() {
  fileInputRef.value?.click();
}

function processImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPG, WEBP, GIF).');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image file size must be less than 5MB.');
    return;
  }

  selectedFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target?.result as string;
    imagePreview.value = dataUrl;

    isUploadingIpfs.value = true;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.uri) {
        form.value.logo = data.data.uri;
      } else {
        form.value.logo = 'ipfs://bafybeiehcgbqotmir6tqi76eorpihucphlry53cx3mmnxgmqjjxpwherwq';
      }
    } catch {
      form.value.logo = 'ipfs://bafybeiehcgbqotmir6tqi76eorpihucphlry53cx3mmnxgmqjjxpwherwq';
    } finally {
      isUploadingIpfs.value = false;
    }
  };
  reader.readAsDataURL(file);
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
  const result = await launchToken(
    {
      name: form.value.name.trim(),
      symbol: form.value.symbol.trim().toUpperCase(),
      description: form.value.description.trim(),
      logo:
        form.value.logo.trim() ||
        'ipfs://bafybeiehcgbqotmir6tqi76eorpihucphlry53cx3mmnxgmqjjxpwherwq',
      socials: {
        website: form.value.website.trim(),
        twitter: form.value.twitter.trim(),
        telegram: form.value.telegram.trim(),
      },
      initialBuyAmountEth: form.value.initialBuyEth || '0',
    },
    selectedVersion.value,
  );

  if (result) {
    emit('tokenCreated', result.tokenAddress);
  }
}
</script>
