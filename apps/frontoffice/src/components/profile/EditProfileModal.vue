<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="w-[calc(100vw-2rem)] sm:max-w-lg bg-card border-border text-foreground transition-all duration-200 max-h-[90vh] overflow-y-auto"
    >
      <DialogHeader>
        <div class="flex items-center gap-2 text-foreground mb-1">
          <Edit3 class="w-5 h-5 text-primary" />
          <DialogTitle>Edit Creator Profile</DialogTitle>
        </div>
        <DialogDescription class="text-xs text-muted-foreground">
          Customize your public creator identity, avatar photo, cover banner, and social handles.
        </DialogDescription>
      </DialogHeader>

      <div
        class="p-2.5 rounded-xl border border-border bg-muted/40 text-[11px] text-muted-foreground font-mono"
      >
        Profile metadata and media are pinned to decentralized IPFS and stored for this wallet address.
      </div>

      <form @submit.prevent="handleSave" class="space-y-4 py-2 font-sans">
        <!-- 1. Header Cover Banner Upload Zone -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-medium">Cover Banner</Label>
            <span class="text-[10px] text-muted-foreground font-mono">Recommended 1200x400</span>
          </div>

          <div
            @dragover.prevent="dragOverBanner = true"
            @dragleave.prevent="dragOverBanner = false"
            @drop.prevent="handleBannerDrop"
            :class="[
              'relative border-2 border-dashed rounded-2xl h-28 sm:h-32 transition-all flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden group',
              dragOverBanner
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-foreground/50 bg-muted/20',
            ]"
            @click="triggerBannerUpload"
          >
            <input
              ref="bannerFileRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="handleBannerFileChange"
            />

            <!-- Banner Image Preview -->
            <img
              v-if="editResolvedBanner"
              :src="editResolvedBanner"
              alt="Banner Preview"
              class="w-full h-full object-cover"
            />

            <!-- Empty / Upload Prompt Overlay -->
            <div
              v-else-if="!isUploadingBanner"
              class="flex flex-col items-center justify-center p-3 text-muted-foreground space-y-1"
            >
              <div class="p-2 rounded-full bg-muted/60 text-foreground">
                <ImageIcon class="w-5 h-5" />
              </div>
              <span class="text-xs font-bold text-foreground font-mono">Upload Cover Banner</span>
              <p class="text-[10px]">Click or drag image (PNG, JPG, WEBP max 8MB)</p>
            </div>

            <div
              v-if="isUploadingBanner"
              class="absolute inset-0 bg-background/80 flex items-center justify-center gap-2 text-xs font-mono"
            >
              <Loader2 class="w-4 h-4 animate-spin text-primary" />
              <span>Optimizing & Pinning Banner...</span>
            </div>

            <!-- Remove Banner Button -->
            <Button
              v-if="form.bannerUrl && !isUploadingBanner"
              type="button"
              variant="destructive"
              size="sm"
              class="absolute top-2 right-2 h-7 px-2 text-[10px] rounded-lg cursor-pointer opacity-90 hover:opacity-100"
              title="Remove cover banner"
              @click.stop="removeBanner"
            >
              <Trash2 class="w-3.5 h-3.5 mr-1" />
              Remove
            </Button>
          </div>

          <div
            v-if="bannerError"
            class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2 font-mono flex items-center gap-1.5"
          >
            <AlertCircle class="w-3.5 h-3.5 shrink-0" />
            <span>{{ bannerError }}</span>
          </div>
        </div>

        <!-- 2. Profile Avatar Upload Zone -->
        <div class="space-y-1.5">
          <Label class="text-xs font-medium">Profile Photo</Label>
          <div
            @dragover.prevent="dragOverAvatar = true"
            @dragleave.prevent="dragOverAvatar = false"
            @drop.prevent="handleAvatarDrop"
            :class="[
              'relative border-2 border-dashed rounded-2xl p-3.5 transition-all flex items-center gap-3.5 text-left cursor-pointer min-w-0 overflow-hidden',
              dragOverAvatar
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-foreground/50 bg-muted/20',
            ]"
            @click="triggerAvatarUpload"
          >
            <input
              ref="avatarFileRef"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="handleAvatarFileChange"
            />

            <!-- Circular Avatar Preview -->
            <Avatar
              class="w-14 h-14 rounded-full border-2 border-border overflow-hidden shrink-0 shadow-xs"
            >
              <img
                v-if="editResolvedAvatar"
                :src="editResolvedAvatar"
                alt="Preview"
                class="w-full h-full object-cover rounded-full"
              />
              <div
                v-else-if="isUploadingAvatar"
                class="w-full h-full flex items-center justify-center bg-muted"
              >
                <Loader2 class="w-5 h-5 text-foreground animate-spin" />
              </div>
              <Jazzicon
                v-else
                :address="profileAddress || '0x0000000000000000000000000000000000000000'"
                :size="56"
                class="w-full h-full rounded-full"
              />
            </Avatar>

            <!-- Status & Action Copy -->
            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  class="text-xs font-bold text-foreground truncate block flex-1 min-w-0 font-mono"
                  :title="avatarFileName || (form.avatarUrl ? 'Custom Photo' : 'Upload from device')"
                >
                  {{ avatarFileName || (form.avatarUrl ? 'Custom Photo' : 'Upload from device') }}
                </span>
                <span
                  v-if="isUploadingAvatar"
                  class="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 font-mono"
                >
                  <Loader2 class="w-2.5 h-2.5 animate-spin text-primary" />
                  Pinning...
                </span>
              </div>
              <p class="text-[11px] text-muted-foreground truncate">
                Click or drag square image (PNG, JPG, WEBP max 5MB).
              </p>
            </div>

            <!-- Remove Photo Button -->
            <Button
              v-if="form.avatarUrl && !isUploadingAvatar"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer"
              title="Remove photo"
              @click.stop="removeAvatar"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </Button>
          </div>

          <!-- Inline Avatar Error Banner -->
          <div
            v-if="avatarError"
            class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2 flex items-start gap-1.5 font-mono"
          >
            <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{{ avatarError }}</span>
          </div>
        </div>

        <!-- 3. Identity Text Inputs -->
        <div class="space-y-1.5">
          <Label for="display-name" class="text-xs font-medium">Display Name</Label>
          <Input
            id="display-name"
            v-model="form.displayName"
            placeholder="e.g. Satoshi Degen"
            maxlength="32"
            class="text-xs rounded-xl"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="bio" class="text-xs font-medium">Bio / Description</Label>
          <Textarea
            id="bio"
            v-model="form.bio"
            placeholder="Short bio about yourself, strategies, or your alpha calls..."
            :maxlength="140"
            class="text-xs resize-none h-16 rounded-xl"
          />
        </div>

        <!-- 4. Social Handles -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label for="edit-x" class="text-xs font-medium">X (Twitter)</Label>
            <div class="relative">
              <span
                class="absolute left-2.5 top-2.5 text-xs font-mono text-muted-foreground select-none"
                >@</span
              >
              <Input
                id="edit-x"
                v-model="form.twitter"
                placeholder="handle"
                class="text-xs pl-7 font-mono rounded-xl"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="edit-tg" class="text-xs font-medium">Telegram</Label>
            <div class="relative">
              <span
                class="absolute left-2.5 top-2.5 text-xs font-mono text-muted-foreground select-none"
                >t.me/</span
              >
              <Input
                id="edit-tg"
                v-model="form.telegram"
                placeholder="handle"
                class="text-xs pl-11 font-mono rounded-xl"
              />
            </div>
          </div>
        </div>

        <DialogFooter class="pt-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="cursor-pointer font-mono rounded-xl"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            class="cursor-pointer font-bold font-mono rounded-xl px-5"
            :disabled="isUploadingAvatar || isUploadingBanner"
          >
            <Loader2 v-if="isUploadingAvatar || isUploadingBanner" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
            <span>Save Profile</span>
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Edit3, Loader2, Trash2, AlertCircle, Image as ImageIcon } from 'lucide-vue-next';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, Jazzicon } from '@/components/ui/avatar';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';
import type { ProfileStorageData } from './types';

const props = defineProps<{
  open: boolean;
  profileAddress: string | null;
  initialData: ProfileStorageData;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'save', data: ProfileStorageData): void;
}>();

const form = ref<ProfileStorageData>({ ...props.initialData });

// Avatar state
const avatarError = ref<string | null>(null);
const avatarFileRef = ref<HTMLInputElement | null>(null);
const isUploadingAvatar = ref(false);
const dragOverAvatar = ref(false);
const avatarFileName = ref('');

// Banner state
const bannerError = ref<string | null>(null);
const bannerFileRef = ref<HTMLInputElement | null>(null);
const isUploadingBanner = ref(false);
const dragOverBanner = ref(false);
const bannerFileName = ref('');

watch(
  () => props.initialData,
  (val) => {
    form.value = { ...val };
  },
  { deep: true, immediate: true },
);

function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('ipfs://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/api/ipfs/')
  );
}

function resolveSafeUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!isSafeImageUrl(trimmed)) return '';
  if (trimmed.startsWith('ipfs://')) {
    const hash = trimmed.replace('ipfs://', '');
    return `/api/ipfs/${hash}`;
  }
  return trimmed;
}

const editResolvedAvatar = computed(() => resolveSafeUrl(form.value.avatarUrl));
const editResolvedBanner = computed(() => resolveSafeUrl(form.value.bannerUrl));

// ---------------------------------------------------------------------------
// Avatar Handlers
// ---------------------------------------------------------------------------

function triggerAvatarUpload() {
  avatarFileRef.value?.click();
}

async function handleAvatarFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    await processAvatarFile(input.files[0]);
  }
}

async function handleAvatarDrop(e: DragEvent) {
  dragOverAvatar.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    await processAvatarFile(e.dataTransfer.files[0]);
  }
}

async function processAvatarFile(file: File) {
  avatarError.value = null;
  if (!file.type.startsWith('image/')) {
    avatarError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    avatarError.value = 'Image file size must be less than 5MB.';
    return;
  }

  avatarFileName.value = file.name;
  try {
    isUploadingAvatar.value = true;
    const processed = await compressAndConvertToWebp(file, 256, 0.85);
    form.value.avatarUrl = processed.dataUrl;

    // Pin file to IPFS storage
    const formData = new FormData();
    formData.append('file', processed.file);
    const res = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      const ipfsUri = data.data?.cid ? `ipfs://${data.data.cid}` : data.data?.uri || data.data?.url || '';
      if (ipfsUri) {
        form.value.avatarUrl = ipfsUri;
      }
    }
  } catch (err) {
    console.warn('[Profile] Avatar upload failed, retaining dataUrl preview:', err);
  } finally {
    isUploadingAvatar.value = false;
  }
}

function removeAvatar() {
  form.value.avatarUrl = '';
  avatarFileName.value = '';
  avatarError.value = null;
  if (avatarFileRef.value) avatarFileRef.value.value = '';
}

// ---------------------------------------------------------------------------
// Banner Handlers
// ---------------------------------------------------------------------------

function triggerBannerUpload() {
  bannerFileRef.value?.click();
}

async function handleBannerFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    await processBannerFile(input.files[0]);
  }
}

async function handleBannerDrop(e: DragEvent) {
  dragOverBanner.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    await processBannerFile(e.dataTransfer.files[0]);
  }
}

async function processBannerFile(file: File) {
  bannerError.value = null;
  if (!file.type.startsWith('image/')) {
    bannerError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    bannerError.value = 'Banner file size must be less than 8MB.';
    return;
  }

  bannerFileName.value = file.name;
  try {
    isUploadingBanner.value = true;
    const processed = await compressAndConvertToWebp(file, 1200, 0.85);
    form.value.bannerUrl = processed.dataUrl;

    // Pin banner to IPFS storage
    const formData = new FormData();
    formData.append('file', processed.file);
    const res = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      const ipfsUri = data.data?.cid ? `ipfs://${data.data.cid}` : data.data?.uri || data.data?.url || '';
      if (ipfsUri) {
        form.value.bannerUrl = ipfsUri;
      }
    }
  } catch (err) {
    console.warn('[Profile] Banner upload failed, retaining dataUrl preview:', err);
  } finally {
    isUploadingBanner.value = false;
  }
}

function removeBanner() {
  form.value.bannerUrl = '';
  bannerFileName.value = '';
  bannerError.value = null;
  if (bannerFileRef.value) bannerFileRef.value.value = '';
}

function handleSave() {
  emit('save', { ...form.value });
  emit('update:open', false);
}
</script>
