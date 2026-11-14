<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg bg-card border-border text-sm">
      <DialogHeader>
        <div class="flex items-center gap-2">
          <DialogTitle class="text-base font-semibold">
            Call ${{ currentToken.symbol }}
          </DialogTitle>
        </div>
        <DialogDescription class="sr-only">Post a call on this token.</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <!-- Mini Token Card Preview -->
        <div
          class="p-3 rounded-xl border border-border bg-muted/40 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <OptimizedImage
              :src="currentToken.logo"
              :alt="currentToken.name"
              :fallback-text="currentToken.symbol"
              :width="36"
              :height="36"
              class="rounded-lg border border-border shrink-0"
            />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-foreground text-sm leading-tight truncate">
                  ${{ currentToken.symbol }}
                </span>
                <span class="text-muted-foreground text-xs truncate">
                  {{ currentToken.name }}
                </span>
              </div>
              <span class="text-xs text-muted-foreground block mt-0.5">
                MC:
                <strong class="text-foreground">{{
                  formatMarketCap(currentMarketData.marketCapUsd)
                }}</strong>
                · Price:
                <strong class="text-foreground">{{
                  formatPriceUsd(currentMarketData.priceUsd)
                }}</strong>
              </span>
            </div>
          </div>

          <div class="text-right shrink-0">
            <span class="text-xs text-muted-foreground block">{{ t('yourPosition') }}</span>
            <span
              class="text-sm font-semibold tabular-nums"
              :class="userHoldingTokensCount > 0 ? 'text-foreground' : 'text-muted-foreground'"
            >
              {{ userHoldingTokensCount > 0 ? `$${userHoldingUsd.toFixed(2)}` : '0 tokens' }}
            </span>
          </div>
        </div>

        <!-- Anti-Spam Position Requirement (Pump.fun Rule: must hold at least $1 worth of token) -->
        <div
          v-if="!hasSufficientHoldingForComment"
          class="p-3 rounded-xl bg-muted/40 border border-border text-foreground flex items-center justify-between gap-3 text-xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs leading-relaxed">
              Hold at least $1 of ${{ currentToken.symbol }} to post a call.
              <span v-if="userHoldingUsd > 0" class="block text-xs text-muted-foreground">
                (Current: ${{ userHoldingUsd.toFixed(2) }})
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            class="h-7 px-2.5 text-xs shrink-0 font-medium cursor-pointer rounded-lg"
            @click="$emit('goToBuy')"
          >
            Buy ${{ Math.max(1, Math.ceil(1 - userHoldingUsd)) }} of ${{ currentToken.symbol }}
          </Button>
        </div>

        <!-- Comment Message / Thesis -->
        <div class="space-y-1.5">
          <Label class="text-xs font-medium text-foreground">{{ t('commentAlpha') }}</Label>
          <textarea
            :value="callContent"
            rows="3"
            maxlength="500"
            :placeholder="`Share your thoughts or post a meme about $${currentToken.symbol}...`"
            class="w-full text-sm p-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            @input="$emit('update:callContent', ($event.target as HTMLTextAreaElement).value)"
          />
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>{{ callContent.length }}/500</span>
          </div>
        </div>

        <!-- Optional image: upload from the device, or paste a link -->
        <div class="space-y-1.5">
          <Label class="text-xs font-medium text-foreground">{{ t('imageUrlOptional') }}</Label>
          <div
            v-if="imagePreview"
            class="relative overflow-hidden rounded-lg border border-border bg-muted/40"
          >
            <img :src="imagePreview" alt="" class="w-full max-h-56 object-contain" />
            <div
              v-if="isUploadingImage"
              class="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-xs text-muted-foreground"
            >
              <Loader2 class="w-4 h-4 animate-spin" />
              Uploading to IPFS...
            </div>
            <Button
              variant="outline"
              size="icon"
              class="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80"
              title="Remove image"
              aria-label="Remove image"
              @click="removeImage"
            >
              <X class="w-3.5 h-3.5" />
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <input
              ref="fileInputRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="onFileChange"
            />
            <Button
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 text-xs shrink-0 cursor-pointer"
              :disabled="isUploadingImage"
              @click="fileInputRef?.click()"
            >
              <ImageIcon class="w-3.5 h-3.5" />
              Upload
            </Button>
            <Input
              :model-value="callImageUrl"
              type="text"
              placeholder="or paste https://... / ipfs://..."
              class="h-8 text-xs"
              @update:model-value="onUrlInput(String($event))"
            />
          </div>
          <p v-if="imageError" class="text-xs text-destructive">{{ imageError }}</p>
        </div>

        <!-- Also share to X toggle -->
        <div class="flex items-center gap-2 pt-1">
          <input
            id="share-call-x"
            :checked="callShareToX"
            type="checkbox"
            class="rounded border-border accent-foreground cursor-pointer"
            @change="$emit('update:callShareToX', ($event.target as HTMLInputElement).checked)"
          />
          <label
            for="share-call-x"
            class="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Also compose tweet to share on X (Twitter)
          </label>
        </div>

        <!-- Error message -->
        <div
          v-if="callError"
          class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2"
        >
          {{ callError }}
        </div>
      </div>

      <DialogFooter class="flex sm:justify-between items-center gap-2 pt-2">
        <Button variant="outline" size="sm" @click="$emit('update:open', false)">{{
          t('cancel')
        }}</Button>
        <Button
          :disabled="
            isPostingCall || isUploadingImage || !callContent.trim() || userTokenBalance <= 0n
          "
          size="sm"
          class="gap-1.5 font-semibold cursor-pointer"
          @click="$emit('postCallout')"
        >
          <Loader2 v-if="isPostingCall" class="w-3.5 h-3.5 animate-spin" />
          <span>{{ t('postCall') }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Loader2, Image as ImageIcon, X } from 'lucide-vue-next';
import { uploadFile } from '@/lib/api-client';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';
import { useI18n } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { formatPriceUsd, formatMarketCap } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';

const { t } = useI18n();

interface Props {
  open: boolean;
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  userHoldingTokensCount: number;
  userHoldingUsd: number;
  hasSufficientHoldingForComment: boolean;
  userTokenBalance: bigint;
  account?: string;
  callContent: string;
  callImageUrl: string;
  callShareToX: boolean;
  callError: string | null;
  isPostingCall: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'update:callContent', val: string): void;
  (e: 'update:callImageUrl', val: string): void;
  (e: 'update:callShareToX', val: boolean): void;
  (e: 'postCallout'): void;
  (e: 'goToBuy'): void;
}>();

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const fileInputRef = ref<HTMLInputElement | null>(null);
const imagePreview = ref('');
const isUploadingImage = ref(false);
const imageError = ref<string | null>(null);

function removeImage(): void {
  imagePreview.value = '';
  imageError.value = null;
  emit('update:callImageUrl', '');
  if (fileInputRef.value) fileInputRef.value.value = '';
}

function onUrlInput(value: string): void {
  // A typed link replaces an uploaded photo.
  imagePreview.value = '';
  emit('update:callImageUrl', value);
}

/** Uploads the picked photo to IPFS right away; the callout then carries its ipfs:// link. */
async function onFileChange(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  imageError.value = null;
  if (!file.type.startsWith('image/')) {
    imageError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    imageError.value = 'Image size must be less than 8MB.';
    return;
  }
  let upload: File = file;
  try {
    const processed = await compressAndConvertToWebp(file, 1200, 0.85);
    imagePreview.value = processed.dataUrl;
    upload = processed.file;
  } catch {
    imagePreview.value = URL.createObjectURL(file);
  }
  isUploadingImage.value = true;
  try {
    const res = await uploadFile<{
      success: boolean;
      data?: { cid?: string; uri?: string; url?: string };
    }>('/api/ipfs/upload', upload);
    const uri = res.data?.cid ? `ipfs://${res.data.cid}` : res.data?.uri || res.data?.url || '';
    if (!uri) throw new Error('Upload returned no link');
    emit('update:callImageUrl', uri);
  } catch (err) {
    imagePreview.value = '';
    imageError.value = (err as Error).message || 'Image upload failed';
    if (fileInputRef.value) fileInputRef.value.value = '';
  } finally {
    isUploadingImage.value = false;
  }
}

// Posted or cleared by the parent: drop the local preview with it.
watch(
  () => props.callImageUrl,
  (url) => {
    if (!url && !isUploadingImage.value) imagePreview.value = '';
  },
);
</script>
