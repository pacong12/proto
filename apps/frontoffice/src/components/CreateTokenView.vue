<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div>
      <div class="flex items-center gap-2">
        <Rocket class="w-6 h-6 text-emerald-400" />
        <h1 class="text-3xl font-bold tracking-tight">Launch a Token</h1>
      </div>
      <p class="text-sm mt-1">
        Deploy a fixed-supply token into permanently locked Uniswap V3 liquidity on Robinhood Chain.
      </p>
    </div>

    <!-- Form container using Shadcn Card -->
    <Card class="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <form @submit.prevent="handleLaunch" class="space-y-5">
        <!-- Token Basic Information -->
        <div class="space-y-1.5">
          <Label for="token-name">Token Name</Label>
          <Input
            id="token-name"
            v-model="form.name"
            type="text"
            placeholder="e.g. Proto Rocket"
            maxlength="60"
            required
          />
        </div>

        <div class="space-y-1.5">
          <Label for="token-symbol">Ticker / Symbol</Label>
          <Input
            id="token-symbol"
            v-model="form.symbol"
            type="text"
            placeholder="e.g. PROT"
            class="uppercase font-mono"
            maxlength="20"
            required
          />
        </div>

        <div class="space-y-1.5">
          <Label for="token-description">Description</Label>
          <Textarea
            id="token-description"
            v-model="form.description"
            :rows="3"
            :maxlength="256"
            placeholder="A short description of the token, project, community or thesis..."
          />
        </div>

        <!-- Token Image Upload / Drag-and-Drop Area -->
        <div class="space-y-1.5">
          <Label>Token Image</Label>
          <div
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            :class="[
              'relative border-2 border-dashed rounded-xl p-4 transition-all flex flex-col sm:flex-row items-center gap-4 text-left cursor-pointer',
              dragOver
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/60',
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

            <!-- Thumbnail Preview or Upload Icon -->
            <div
              class="w-16 h-16 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden relative"
            >
              <img
                v-if="imagePreview"
                :src="imagePreview"
                alt="Token preview"
                class="w-full h-full object-cover"
                :class="{ 'opacity-50': isUploadingIpfs }"
              />
              <UploadCloud v-else class="w-6 h-6 text-zinc-400 dark:text-zinc-600" />
              <div
                v-if="isUploadingIpfs"
                class="absolute inset-0 bg-black/40 flex items-center justify-center"
              >
                <Loader2 class="w-6 h-6 animate-spin text-white" />
              </div>
            </div>

            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-black dark:text-white">
                  {{ selectedFileName || 'Choose image or drop here' }}
                </span>
                <Badge
                  v-if="isUploadingIpfs"
                  variant="secondary"
                  class="text-[10px] animate-pulse flex items-center gap-1 text-black dark:text-white"
                >
                  <Loader2 class="w-2.5 h-2.5 animate-spin" />
                  Uploading to IPFS...
                </Badge>
                <Badge v-else-if="selectedFileName" variant="secondary" class="text-[10px]">
                  Ready
                </Badge>
              </div>
              <p class="text-[11px] leading-normal text-black dark:text-white">
                Supports PNG, JPG, WEBP or GIF (Max 5MB). Automatically pinned to IPFS.
              </p>
            </div>

            <Button
              v-if="imagePreview"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300"
              @click.stop="clearImage"
            >
              Remove
            </Button>
          </div>
        </div>

        <!-- Web & Social Links (Optional) -->
        <div class="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider">Links (Optional)</span>
            <span class="text-[11px]">Self-describing onchain metadata</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="space-y-1">
              <Label for="token-website" class="text-[11px]">Website</Label>
              <Input
                id="token-website"
                v-model="form.website"
                type="url"
                placeholder="https://..."
                class="text-xs"
              />
            </div>
            <div class="space-y-1">
              <Label for="token-x" class="text-[11px]">X (Twitter)</Label>
              <Input
                id="token-x"
                v-model="form.twitter"
                type="text"
                placeholder="x.com/handle"
                class="text-xs"
              />
            </div>
            <div class="space-y-1">
              <Label for="token-tg" class="text-[11px]">Telegram</Label>
              <Input
                id="token-tg"
                v-model="form.telegram"
                type="text"
                placeholder="t.me/community"
                class="text-xs"
              />
            </div>
          </div>
        </div>

        <!-- Creator Initial Buy & Tokenomics Parameters -->
        <div class="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          <div class="space-y-1.5">
            <div class="flex justify-between items-center">
              <Label for="token-initial-buy">Developer Buy (Optional)</Label>
              <span class="text-[11px]">Pairs directly into initial Uniswap V3 pool</span>
            </div>
            <Input
              id="token-initial-buy"
              v-model="form.initialBuyEth"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00 ETH"
              class="font-mono text-sm"
            />
          </div>

          <!-- Advanced Tax Settings Accordion with Shadcn Card -->
          <Card
            class="rounded-xl border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40 overflow-hidden p-0"
          >
            <button
              type="button"
              @click="advancedOpen = !advancedOpen"
              class="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold transition hover:bg-zinc-100 dark:hover:bg-zinc-900/50 cursor-pointer"
            >
              <span class="flex items-center gap-2">
                <SlidersHorizontal class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                Advanced Creator Tax &amp; Fee Sharing
              </span>
              <ChevronDown
                class="w-3.5 h-3.5 transition-transform duration-200 opacity-60"
                :class="advancedOpen ? 'rotate-180' : ''"
              />
            </button>

            <div
              v-show="advancedOpen"
              class="px-4 pb-4 pt-1 space-y-3.5 border-t border-zinc-200 dark:border-zinc-800/60"
            >
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <div class="flex justify-between items-center">
                    <Label for="buy-tax" class="text-[11px]">Buy Tax</Label>
                    <span
                      class="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-semibold"
                      >{{ form.buyTax }}%</span
                    >
                  </div>
                  <Input
                    id="buy-tax"
                    v-model="form.buyTax"
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="0"
                    class="font-mono text-xs"
                  />
                  <p class="text-[10px]">Max 10% creator buy tax.</p>
                </div>

                <div class="space-y-1">
                  <div class="flex justify-between items-center">
                    <Label for="sell-tax" class="text-[11px]">Sell Tax</Label>
                    <span
                      class="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-semibold"
                      >{{ form.sellTax }}%</span
                    >
                  </div>
                  <Input
                    id="sell-tax"
                    v-model="form.sellTax"
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="0"
                    class="font-mono text-xs"
                  />
                  <p class="text-[10px]">Max 10% creator sell tax.</p>
                </div>
              </div>

              <div class="space-y-1 pt-1">
                <Label for="creator-wallet" class="text-[11px]">Creator Tax &amp; Fee Wallet</Label>
                <Input
                  id="creator-wallet"
                  v-model="form.creatorWallet"
                  type="text"
                  placeholder="Leave blank to use your connected wallet"
                  class="font-mono text-xs"
                />
                <p class="text-[10px]">
                  Receives your 70% accrued pool fees and custom trading taxes.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <!-- Protocol Invariants Badge Details -->
        <Card
          class="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/80 p-4 space-y-2.5 text-xs"
        >
          <div class="flex justify-between items-center">
            <span class="flex items-center gap-1.5">
              <Lock class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              Fixed Total Supply
            </span>
            <span class="font-mono font-medium">1,000,000,000</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="flex items-center gap-1.5">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              Anti-Snipe Window
            </span>
            <span class="text-emerald-600 dark:text-emerald-400 font-semibold"
              >2 Blocks (Max Buy 5.5%, Max Hold 5%)</span
            >
          </div>
          <div class="flex justify-between items-center">
            <span>Pool Fee Tier</span>
            <span class="font-mono">1% (10000)</span>
          </div>
          <div class="flex justify-between items-center">
            <span>Launch Protocol Fee</span>
            <span class="font-mono">0.0005 ETH</span>
          </div>
          <div
            class="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800/60"
          >
            <span>Trading Fee Split</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-semibold"
              >70% Creator / 30% Protocol</span
            >
          </div>
        </Card>

        <!-- Submit / Connect Action with Shadcn Button -->
        <Button
          type="submit"
          :disabled="loading || isUploadingIpfs || !isConnected"
          size="lg"
          class="w-full"
        >
          <Rocket class="w-4 h-4 mr-1.5" />
          {{
            isUploadingIpfs
              ? 'Uploading Image to IPFS...'
              : loading
                ? 'Launching onchain...'
                : isConnected
                  ? 'Launch Token'
                  : 'Connect Wallet to Launch'
          }}
        </Button>

        <div
          v-if="!isConnected"
          class="flex items-start gap-2 text-xs text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>Connect your wallet to launch a token on Robinhood Chain.</span>
        </div>

        <div
          v-if="error"
          class="flex items-start gap-2 text-xs text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-3"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ error }}</span>
        </div>
      </form>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Rocket,
  ShieldCheck,
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

const emit = defineEmits<{
  (e: 'tokenCreated', address: string): void;
}>();

const { launchToken, loading, error } = useLaunchpad();
const { isConnected } = useWallet();

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');
const imagePreview = ref('');
const dragOver = ref(false);
const advancedOpen = ref(false);

const isUploadingIpfs = ref(false);
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
      const res = await fetch('http://localhost:3001/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const json = (await res.json()) as {
          success?: boolean;
          data?: { cid?: string; url?: string };
        };
        if (json.success && json.data?.cid) {
          form.value.logo = `ipfs://${json.data.cid}`;
        } else if (json.data?.url) {
          form.value.logo = json.data.url;
        } else {
          form.value.logo = dataUrl;
        }
      } else {
        form.value.logo = dataUrl;
      }
    } catch (err) {
      console.warn('IPFS upload endpoint unavailable, using fallback data URL:', err);
      form.value.logo = dataUrl;
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

function clearImage() {
  selectedFileName.value = '';
  imagePreview.value = '';
  form.value.logo = '';
  isUploadingIpfs.value = false;
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

async function handleLaunch() {
  const result = await launchToken({
    name: form.value.name,
    symbol: form.value.symbol,
    logo: form.value.logo || 'ipfs://default-token-icon',
    description: form.value.description,
    socials: {
      website: form.value.website,
      twitter: form.value.twitter,
      telegram: form.value.telegram,
    },
    initialBuyAmountEth: form.value.initialBuyEth || undefined,
  });

  if (result) {
    emit('tokenCreated', result.tokenAddress);
  }
}
</script>
