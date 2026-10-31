<template>
  <Card class="p-4 sm:p-5 space-y-3.5">
    <div class="flex items-start gap-3">
      <div class="relative shrink-0">
        <Jazzicon
          :address="account || '0x0000000000000000000000000000000000000000'"
          :size="40"
          class="rounded-full ring-2 ring-border/80"
        />
        <span
          v-if="account"
          class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-foreground border-2 border-background"
          title="Wallet Connected"
        />
      </div>

      <div class="flex-1 min-w-0 space-y-3 relative">
        <!-- Textarea with Live $ Cashtag Autocomplete -->
        <div class="relative">
          <textarea
            ref="composerTextarea"
            v-model="composerContent"
            rows="3"
            maxlength="500"
            placeholder="Call a token or share alpha... (type $ to select a token, e.g. $SPIDER!)"
            class="w-full text-sm sm:text-base p-3.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground focus:border-border resize-none leading-relaxed"
            @input="handleComposerInput"
            @keydown="handleComposerKeydown"
          />

          <!-- Floating $ Cashtag Live Autocomplete Popup -->
          <div
            v-if="showCashtagSuggestions && cashtagSuggestions.length > 0"
            class="absolute left-0 right-0 top-full mt-1 bg-card border border-border/90 rounded-2xl shadow-2xl p-2 z-50 space-y-1 text-xs max-h-56 overflow-y-auto"
          >
            <div
              class="px-2 py-1 text-xs text-muted-foreground uppercase font-bold flex items-center justify-between border-b border-border/50"
            >
              <span class="flex items-center gap-1">
                Select Token for Callout ${{ cashtagQuery || '' }}
              </span>
              <span class="text-xs">Tab / Enter to pick</span>
            </div>

            <button
              v-for="(tItem, sIdx) in cashtagSuggestions"
              :key="tItem.token.address"
              type="button"
              class="w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-left"
              :class="
                sIdx === selectedSuggestionIndex
                  ? 'bg-muted text-foreground font-bold'
                  : 'hover:bg-muted/60 text-foreground'
              "
              @click="selectCashtagToken(tItem.token)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <OptimizedImage
                  :src="tItem.token.logo"
                  :alt="tItem.token.name"
                  :fallback-text="tItem.token.symbol"
                  :width="22"
                  :height="22"
                  class="rounded-md shrink-0 border border-border/50"
                />
                <div class="min-w-0">
                  <span class="font-black text-foreground block text-xs truncate">
                    ${{ tItem.token.symbol }}
                  </span>
                  <span class="text-xs text-muted-foreground truncate block font-sans">
                    {{ tItem.token.name }}
                  </span>
                </div>
              </div>

              <div class="text-right shrink-0">
                <span class="text-xs font-bold block text-foreground">
                  {{ formatMarketCap(tItem.marketData?.marketCapUsd) }}
                </span>
                <span
                  class="text-xs font-bold"
                  :class="
                    (tItem.marketData?.priceChange24h ?? 0) >= 0
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  "
                >
                  {{ (tItem.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
                  }}{{ (tItem.marketData?.priceChange24h ?? 0).toFixed(1) }}%
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- Twitter / X Style Attached Image Preview Card -->
        <div
          v-if="composerImagePreview"
          class="relative rounded-2xl overflow-hidden border border-border/80 bg-muted/20 max-h-72 w-full group"
        >
          <img
            :src="composerImagePreview"
            alt="Attached Preview"
            class="w-full h-full object-cover max-h-72"
          />

          <!-- Top-Right Remove (X) Button like Twitter -->
          <button
            type="button"
            class="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition cursor-pointer shadow-md backdrop-blur-xs"
            title="Remove image"
            @click="removeAttachedImage"
          >
            <X class="w-4 h-4" />
          </button>

          <!-- Uploading / Pinning Status Banner -->
          <div
            v-if="isUploadingMedia"
            class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs text-white"
          >
            <Loader2 class="w-4 h-4 animate-spin text-muted-foreground" />
            <span>Uploading to IPFS...</span>
          </div>
        </div>

        <!-- Media Attachment Input -->
        <div v-if="showMediaInput" class="pt-1">
          <Input
            v-model="composerImageUrl"
            type="text"
            placeholder="Image / Chart URL (https://... or ipfs://...)"
            class="h-8 text-xs rounded-xl"
          />
        </div>

        <!-- On-Chain Balance Verifier (Holder Badge) -->
        <div
          v-if="account && selectedToken && callerPositionUsd >= 1.0"
          class="p-2.5 rounded-xl bg-muted/40 border border-border text-foreground flex items-center justify-between gap-2 text-xs"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <ShieldCheck class="w-4 h-4 shrink-0 text-foreground" />
            <span class="truncate">
              Verified Holder (${{ callerPositionUsd.toFixed(2) }}):
              <strong>{{ callerTokenBalance.toLocaleString() }} ${{ selectedToken.symbol }}</strong>
            </span>
          </div>
        </div>

        <div
          v-else-if="account && selectedToken && callerPositionUsd < 1.0 && !checkingBalance"
          class="p-2 rounded-xl bg-muted/40 border border-border text-muted-foreground flex items-center justify-between gap-2 text-xs font-sans"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-xs">
              Mentioning ${{ selectedToken.symbol }} &middot; Hold $1+ to earn a Verified Holder
              badge.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            class="h-6 px-2 text-xs shrink-0 rounded-lg cursor-pointer border-border"
            @click="emit('navigateToToken', selectedToken.address)"
          >
            Buy ${{ selectedToken.symbol }}
          </Button>
        </div>

        <!-- Composer Footer Toolbar -->
        <div class="flex items-center justify-between pt-1 border-t border-border/50">
          <div class="flex items-center gap-2">
            <!-- Hidden File Input for Device Photo Upload like Twitter -->
            <input
              ref="mediaFileInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="handleMediaFileChange"
            />

            <Button
              variant="outline"
              size="sm"
              class="h-8 px-2 gap-1.5 text-muted-foreground"
              :class="composerImagePreview ? 'border-foreground/40 bg-muted text-foreground' : ''"
              title="Upload photo from device (like Twitter)"
              @click="triggerMediaUpload"
            >
              <ImageIcon class="w-4 h-4" />
              <span class="text-xs hidden sm:inline">Photo</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              class="h-8 px-2 gap-1.5 text-muted-foreground"
              :class="showMediaInput ? 'border-foreground/40 bg-muted text-foreground' : ''"
              title="Paste Image or Chart URL"
              @click="showMediaInput = !showMediaInput"
            >
              <Link2 class="w-4 h-4" />
            </Button>

            <span class="text-xs text-muted-foreground"> {{ composerContent.length }}/500 </span>
          </div>

          <Button
            size="sm"
            class="rounded-xl px-5 h-9 font-bold text-sm gap-1.5"
            :disabled="
              isPostingCall ||
              !composerContent.trim() ||
              (selectedToken !== null && callerTokenBalance <= 0)
            "
            @click="submitCallout"
          >
            <Loader2 v-if="isPostingCall" class="w-3.5 h-3.5 animate-spin" />
            <Megaphone v-else class="w-3.5 h-3.5" />
            <span>Post Call</span>
          </Button>
        </div>

        <div
          v-if="composerError"
          class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-2.5 mt-2"
        >
          {{ composerError }}
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Loader2, Image as ImageIcon, Megaphone, ShieldCheck, X, Link2 } from 'lucide-vue-next';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { useFeed } from '@/composables/useFeed';
import { uploadFile } from '@/lib/api-client';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Jazzicon } from '@/components/ui/avatar';
import { toast } from '@/components/ui/sonner';
import { formatMarketCap } from '@/lib/utils';
import type { FeedCalloutItem, LaunchedTokenEntity } from '@goton/shared-types';

/** Writes a callout: $cashtag autocomplete, holder check, optional image, then posts it. */
const emit = defineEmits<{
  (e: 'posted', call: FeedCalloutItem): void;
  (e: 'navigateToToken', address: string): void;
}>();

const { account, openWallet, activeNetwork } = useWallet();
const { networkTokens } = useTokenStore();
const { postCallout, fetchCallerBalance } = useFeed();

const composerContent = ref('');
const composerImageUrl = ref('');
const composerImagePreview = ref('');
const pendingMediaFile = ref<File | null>(null);
const mediaFileInputRef = ref<HTMLInputElement | null>(null);
const isUploadingMedia = ref(false);
const showMediaInput = ref(false);
const isPostingCall = ref(false);
const composerError = ref<string | null>(null);
const selectedToken = ref<LaunchedTokenEntity | null>(null);
const callerTokenBalance = ref<number>(0);
const checkingBalance = ref(false);

function triggerMediaUpload(): void {
  mediaFileInputRef.value?.click();
}

async function handleMediaFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    await processMediaFile(input.files[0]);
  }
}

async function processMediaFile(file: File): Promise<void> {
  composerError.value = null;
  if (!file.type.startsWith('image/')) {
    composerError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    composerError.value = 'Image size must be less than 8MB.';
    return;
  }

  try {
    // Generate instant local preview immediately (zero delay / no immediate network upload)
    const processed = await compressAndConvertToWebp(file, 1200, 0.85);
    composerImagePreview.value = processed.dataUrl;
    pendingMediaFile.value = processed.file;
  } catch (err) {
    console.warn('[Feed] Local compression failed, using direct object URL preview:', err);
    composerImagePreview.value = URL.createObjectURL(file);
    pendingMediaFile.value = file;
  }
}

function removeAttachedImage(): void {
  composerImagePreview.value = '';
  composerImageUrl.value = '';
  pendingMediaFile.value = null;
  if (mediaFileInputRef.value) mediaFileInputRef.value.value = '';
}

// Live Cashtag ($) Autocomplete State
const composerTextarea = ref<HTMLTextAreaElement | null>(null);
const showCashtagSuggestions = ref(false);
const cashtagQuery = ref('');
const selectedSuggestionIndex = ref(0);

const cashtagSuggestions = computed(() => {
  if (!showCashtagSuggestions.value) return [];
  const q = cashtagQuery.value.trim().toLowerCase();
  const pool = networkTokens.value;
  if (!q) return pool.slice(0, 8);
  return pool
    .filter(
      (t) =>
        t.token.symbol.toLowerCase().includes(q) ||
        t.token.name.toLowerCase().includes(q) ||
        t.token.address.toLowerCase().includes(q),
    )
    .slice(0, 8);
});

function handleComposerInput(): void {
  const textarea = composerTextarea.value;
  const cursor = textarea ? textarea.selectionStart : composerContent.value.length;
  const textBeforeCursor = composerContent.value.slice(0, cursor);

  // Match the latest $ trigger (e.g. "$", "$SP", etc.)
  const match = textBeforeCursor.match(/(?:^|\s)\$([a-zA-Z0-9_]*)$/);

  if (match) {
    showCashtagSuggestions.value = true;
    cashtagQuery.value = match[1];
    selectedSuggestionIndex.value = 0;
  } else {
    showCashtagSuggestions.value = false;
  }

  // Auto-detect if user typed full cashtag, e.g. $SPIDER
  const symbols = networkTokens.value;
  for (const item of symbols) {
    const regex = new RegExp(`\\$${item.token.symbol}\\b`, 'i');
    if (regex.test(composerContent.value)) {
      selectedToken.value = item.token;
      checkCallerPosition(item.token.address);
      break;
    }
  }
}

function handleComposerKeydown(e: KeyboardEvent): void {
  if (!showCashtagSuggestions.value || cashtagSuggestions.value.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggestionIndex.value =
      (selectedSuggestionIndex.value + 1) % cashtagSuggestions.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggestionIndex.value =
      (selectedSuggestionIndex.value - 1 + cashtagSuggestions.value.length) %
      cashtagSuggestions.value.length;
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    const token = cashtagSuggestions.value[selectedSuggestionIndex.value]?.token;
    if (token) {
      selectCashtagToken(token);
    }
  } else if (e.key === 'Escape') {
    showCashtagSuggestions.value = false;
  }
}

function selectCashtagToken(token: LaunchedTokenEntity): void {
  const textarea = composerTextarea.value;
  const cursor = textarea ? textarea.selectionStart : composerContent.value.length;
  const textBeforeCursor = composerContent.value.slice(0, cursor);
  const textAfterCursor = composerContent.value.slice(cursor);

  // Replace the latest $... trigger with the full $SYMBOL
  const replacedBefore = textBeforeCursor.replace(/(?:^|\s)\$([a-zA-Z0-9_]*)$/, (m) => {
    const leadingSpace = m.startsWith(' ') || m.startsWith('\n') ? m[0] : '';
    return `${leadingSpace}$${token.symbol} `;
  });

  composerContent.value = `${replacedBefore}${textAfterCursor}`;
  selectedToken.value = token;
  showCashtagSuggestions.value = false;
  checkCallerPosition(token.address);

  setTimeout(() => {
    if (textarea) {
      textarea.focus();
      const nextPos = replacedBefore.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }
  }, 10);
}

async function checkCallerPosition(tokenAddress: string): Promise<void> {
  if (!account.value || !tokenAddress) {
    callerTokenBalance.value = 0;
    return;
  }
  checkingBalance.value = true;
  try {
    callerTokenBalance.value = await fetchCallerBalance(tokenAddress, account.value);
  } finally {
    checkingBalance.value = false;
  }
}

function detectTokenFromContent(text: string): LaunchedTokenEntity | null {
  const match = text.match(/\$([a-zA-Z0-9_]+)/);
  if (!match) return null;
  const symbol = match[1].toLowerCase();
  const pool = networkTokens.value;
  const found = pool.find(
    (t) => t.token.symbol.toLowerCase() === symbol || t.token.name.toLowerCase() === symbol,
  );
  return found ? found.token : null;
}

watch(composerContent, (newVal) => {
  const detected = detectTokenFromContent(newVal);
  if (detected && (!selectedToken.value || selectedToken.value.address !== detected.address)) {
    selectedToken.value = detected;
    checkCallerPosition(detected.address);
  } else if (!detected && !newVal.includes('$')) {
    selectedToken.value = null;
    callerTokenBalance.value = 0;
  }
});

const callerPositionUsd = computed(() => {
  if (!selectedToken.value || callerTokenBalance.value <= 0) return 0;
  const item = networkTokens.value.find((t) => t.token.address === selectedToken.value?.address);
  const price = item?.marketData?.priceUsd || 0;
  return callerTokenBalance.value * price;
});

async function submitCallout(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  const content = composerContent.value.trim();
  if (!content) return;

  const targetToken =
    selectedToken.value ||
    detectTokenFromContent(content) ||
    (networkTokens.value?.[0]?.token ?? null);
  if (!targetToken) {
    composerError.value = 'Please mention a token (e.g. $TOKEN) or launch one first.';
    return;
  }

  isPostingCall.value = true;
  composerError.value = null;

  try {
    let finalImageUrl = composerImageUrl.value.trim() || undefined;

    // Upload pending media in background on submit
    if (pendingMediaFile.value) {
      isUploadingMedia.value = true;
      try {
        const data = await uploadFile<{
          success: boolean;
          data?: { cid?: string; uri?: string; url?: string };
        }>('/api/ipfs/upload', pendingMediaFile.value);
        const ipfsUri = data.data?.cid
          ? `ipfs://${data.data.cid}`
          : data.data?.uri || data.data?.url || '';
        if (ipfsUri) {
          finalImageUrl = ipfsUri;
        }
      } catch (uploadErr) {
        console.warn('[Feed] IPFS upload on submit fallback:', uploadErr);
        if (!finalImageUrl && composerImagePreview.value) {
          finalImageUrl = composerImagePreview.value;
        }
      } finally {
        isUploadingMedia.value = false;
      }
    }

    const created = await postCallout({
      tokenAddress: targetToken.address,
      authorAddress: account.value,
      content,
      imageUrl: finalImageUrl,
    });
    if (created) {
      toast.success(`Posted call on $${targetToken.symbol}!`);
      composerContent.value = '';
      composerImageUrl.value = '';
      composerImagePreview.value = '';
      pendingMediaFile.value = null;
      showMediaInput.value = false;
      emit('posted', created);
    }
  } catch (err) {
    composerError.value = (err as Error).message || 'Failed to post callout.';
  } finally {
    isPostingCall.value = false;
  }
}

// The chain changed, or its tokens arrived: preselect its first token for the holder check.
watch(
  [activeNetwork, () => networkTokens.value.length],
  ([, count], previous) => {
    const chainChanged = previous && previous[0] !== activeNetwork.value;
    if (!chainChanged && selectedToken.value) return;
    selectedToken.value = count > 0 ? networkTokens.value[0].token : null;
    if (selectedToken.value) checkCallerPosition(selectedToken.value.address);
  },
  { immediate: true },
);
</script>
