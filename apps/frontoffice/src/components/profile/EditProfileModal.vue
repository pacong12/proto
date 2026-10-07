<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="w-[calc(100vw-2rem)] sm:max-w-lg bg-card border-border text-foreground transition-all duration-200"
    >
      <DialogHeader>
        <div class="flex items-center gap-2 text-foreground mb-1">
          <Edit3 class="w-5 h-5" />
          <DialogTitle>Edit Creator Profile</DialogTitle>
        </div>
        <DialogDescription class="text-xs text-muted-foreground">
          Customize your public creator identity, social handles, and bio.
        </DialogDescription>
      </DialogHeader>

      <div
        class="p-2.5 rounded-lg border border-border bg-muted/40 text-[11px] text-muted-foreground font-mono"
      >
        Profile metadata is stored in your local browser session for this wallet address.
      </div>

      <form @submit.prevent="handleSave" class="space-y-4 py-2 font-sans">
        <div class="space-y-1.5">
          <Label for="display-name" class="text-xs font-medium">Display Name</Label>
          <Input
            id="display-name"
            v-model="form.displayName"
            placeholder="e.g. Satoshi Degen"
            maxlength="32"
            class="text-xs"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="bio" class="text-xs font-medium">Bio / Description</Label>
          <Textarea
            id="bio"
            v-model="form.bio"
            placeholder="Short bio about yourself or your projects..."
            :maxlength="120"
            class="text-xs resize-none h-16"
          />
        </div>

        <!-- Profile Photo Upload Zone -->
        <div class="space-y-1.5">
          <Label class="text-xs font-medium">Profile Photo</Label>
          <div
            @dragover.prevent="dragOverAvatar = true"
            @dragleave.prevent="dragOverAvatar = false"
            @drop.prevent="handleAvatarDrop"
            :class="[
              'relative border-2 border-dashed rounded-xl p-3.5 transition-all flex items-center gap-3.5 text-left cursor-pointer min-w-0 overflow-hidden',
              dragOverAvatar
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-foreground/50',
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
              class="w-14 h-14 rounded-full border border-border overflow-hidden shrink-0 shadow-xs"
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
                  <Loader2 class="w-2.5 h-2.5 animate-spin" />
                  Optimizing...
                </span>
              </div>
              <p class="text-[11px] text-muted-foreground truncate">
                Click or drag image (PNG, JPG, WEBP max 5MB).
              </p>
            </div>

            <!-- Remove Photo Button -->
            <Button
              v-if="form.avatarUrl"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded cursor-pointer"
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

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label for="edit-x" class="text-xs font-medium">X (Twitter)</Label>
            <div class="relative">
              <span
                class="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground select-none"
                >@</span
              >
              <Input
                id="edit-x"
                v-model="form.twitter"
                placeholder="handle"
                class="text-xs pl-7 font-mono"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="edit-tg" class="text-xs font-medium">Telegram</Label>
            <div class="relative">
              <span
                class="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground select-none"
                >t.me/</span
              >
              <Input
                id="edit-tg"
                v-model="form.telegram"
                placeholder="handle"
                class="text-xs pl-11 font-mono"
              />
            </div>
          </div>
        </div>

        <DialogFooter class="pt-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="cursor-pointer font-mono"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            class="cursor-pointer font-bold font-mono"
            :disabled="isUploadingAvatar"
          >
            Save Profile
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Edit3, Loader2, Trash2, AlertCircle } from 'lucide-vue-next';
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
const avatarError = ref<string | null>(null);
const avatarFileRef = ref<HTMLInputElement | null>(null);
const isUploadingAvatar = ref(false);
const dragOverAvatar = ref(false);
const avatarFileName = ref('');

watch(
  () => props.initialData,
  (val) => {
    form.value = { ...val };
  },
  { deep: true },
);

function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('ipfs://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  );
}

const editResolvedAvatar = computed(() => {
  if (!form.value.avatarUrl) return '';
  const url = form.value.avatarUrl.trim();
  if (!isSafeImageUrl(url)) return '';
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return url;
});

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
  } catch (err) {
    avatarError.value = (err as Error).message || 'Failed to process avatar image.';
  } finally {
    isUploadingAvatar.value = false;
  }
}

function removeAvatar() {
  form.value.avatarUrl = '';
  avatarFileName.value = '';
  avatarError.value = null;
}

function handleSave() {
  emit('save', { ...form.value });
  emit('update:open', false);
}
</script>
