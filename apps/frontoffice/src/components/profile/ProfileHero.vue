<template>
  <!-- Profile Hero: Hybrid Twitter Cover Banner x Web3 Identity Card -->
  <div class="rounded-3xl border border-border bg-card overflow-hidden shadow-sm font-sans">
    <!-- 1. Ambient Banner -->
    <div
      class="h-28 sm:h-44 bg-card relative overflow-hidden border-b border-border group"
      :class="isOwnProfile ? 'cursor-pointer' : ''"
      @click="isOwnProfile && emit('edit')"
    >
      <img
        v-if="resolvedBannerUrl"
        :src="resolvedBannerUrl"
        alt="Cover Banner"
        class="w-full h-full object-cover"
      />
      <div v-else class="absolute inset-0 bg-black" />

      <div
        v-if="isOwnProfile"
        class="absolute inset-0 bg-background/50 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
        title="Update header banner"
      >
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-card text-foreground shadow-xs border border-border pointer-events-auto"
        >
          <Camera class="w-3.5 h-3.5 text-primary" />
          Update Banner
        </span>
      </div>
    </div>

    <!-- 2. Profile Details & Avatar Overlay -->
    <div class="px-5 pb-5 sm:px-7 sm:pb-7 pt-0 space-y-4 relative z-30">
      <div
        class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-14 relative z-30"
      >
        <!-- Avatar -->
        <div
          class="relative z-30 group w-20 h-20 sm:w-28 sm:h-28 rounded-full ring-4 ring-card bg-card overflow-hidden shrink-0 shadow-xl"
          :class="isOwnProfile ? 'cursor-pointer' : ''"
          @click="isOwnProfile && emit('edit')"
        >
          <img
            v-if="resolvedAvatarUrl"
            :src="resolvedAvatarUrl"
            :alt="profileData.displayName"
            class="w-full h-full object-cover rounded-full"
          />
          <Jazzicon
            v-else
            :address="profileAddress || '0x0000000000000000000000000000000000000000'"
            :size="112"
            class="w-full h-full rounded-full"
          />
          <div
            v-if="isOwnProfile"
            class="absolute inset-0 rounded-full bg-background/50 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Update profile photo"
          >
            <Camera class="w-6 h-6 text-foreground" />
          </div>
        </div>

        <!-- Action Buttons (Top Right of Profile) -->
        <div class="flex items-center gap-2 self-start sm:self-end">
          <Button
            v-if="!isOwnProfile && profileAddress"
            :variant="stats.isFollowing ? 'outline' : 'default'"
            size="sm"
            class="h-8 min-w-24 text-xs font-bold cursor-pointer rounded-xl"
            :disabled="busy"
            @click="onFollow"
          >
            {{ stats.isFollowing ? t('followingAction') : t('followAction') }}
          </Button>
          <Button
            v-if="isOwnProfile"
            variant="outline"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted text-foreground cursor-pointer rounded-xl"
            @click="emit('edit')"
          >
            <Edit3 class="w-3.5 h-3.5" />
            Edit Profile
          </Button>

          <Button
            variant="default"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 font-bold cursor-pointer rounded-xl"
            @click="emit('share')"
          >
            <Share2 class="w-3.5 h-3.5" />
            {{ copiedShare ? t('addressCopied') : t('shareProfile') }}
          </Button>
        </div>
      </div>

      <!-- Identity & Bio -->
      <div class="space-y-1.5 pt-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h1
            class="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground [overflow-wrap:anywhere]"
          >
            {{
              profileData.displayName ||
              (profileAddress ? getUserIdentity(profileAddress).displayName : 'Anonymous Creator')
            }}
          </h1>
        </div>

        <p class="text-sm text-muted-foreground flex items-center gap-1.5">
          <span
            >@{{ profileAddress ? getUserIdentity(profileAddress).name : 'not-connected' }}</span
          >
          <span class="text-muted-foreground/40">&middot;</span>
          <span>{{ profileAddress ? shortenAddress(profileAddress, 6, 4) : '' }}</span>
        </p>

        <!-- Followers / following -->
        <div v-if="profileAddress" class="flex items-center gap-4 text-sm">
          <button
            type="button"
            class="inline-flex items-baseline gap-1 hover:underline underline-offset-2 cursor-pointer"
            @click="openList('followers')"
          >
            <span class="font-bold text-foreground tabular-nums">{{ stats.followers }}</span>
            <span class="text-muted-foreground"> {{ t('followersLabel') }}</span>
          </button>
          <button
            type="button"
            class="inline-flex items-baseline gap-1 hover:underline underline-offset-2 cursor-pointer"
            @click="openList('following')"
          >
            <span class="font-bold text-foreground tabular-nums">{{ stats.following }}</span>
            <span class="text-muted-foreground"> {{ t('followingLabel') }}</span>
          </button>
          <span v-if="followError" class="text-xs text-rose-500">{{ followError }}</span>
        </div>

        <p class="text-sm sm:text-base text-foreground/90 max-w-2xl font-sans leading-relaxed">
          {{
            profileData.bio ||
            'Non-custodial creator and alpha trader on Goton multi-chain launchpad.'
          }}
        </p>

        <!-- Metadata Ribbon: Social Handles & Block Explorer -->
        <div class="flex items-center gap-4 pt-1 text-sm text-muted-foreground flex-wrap">
          <a
            v-if="profileData.twitter"
            :href="`https://x.com/${profileData.twitter}`"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition flex items-center gap-1.5"
          >
            <span>@{{ profileData.twitter }}</span>
          </a>
          <a
            v-if="profileData.telegram"
            :href="`https://t.me/${profileData.telegram}`"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition flex items-center gap-1.5"
          >
            <span>t.me/{{ profileData.telegram }}</span>
          </a>
          <a
            v-if="profileAddress"
            :href="`${activeNetwork.blockExplorer}/address/${profileAddress}`"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground transition flex items-center gap-1"
          >
            <span>{{ t('explorer') }}</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>

    <Dialog v-model:open="listOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ listDirection === 'followers' ? t('followersLabel') : t('followingLabel') }}
          </DialogTitle>
        </DialogHeader>
        <p v-if="listRows.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          {{ listDirection === 'followers' ? t('noFollowers') : t('noFollowing') }}
        </p>
        <ul v-else class="max-h-80 overflow-y-auto -mx-2">
          <li v-for="row in listRows" :key="row.address">
            <RouterLink
              :to="`/${row.identity.name}`"
              class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition"
              @click="listOpen = false"
            >
              <Jazzicon :address="row.address" :size="32" class="rounded-full shrink-0" />
              <div class="min-w-0">
                <span class="block text-sm font-bold text-foreground truncate">
                  {{ row.identity.displayName }}
                </span>
                <span class="block text-xs text-muted-foreground">
                  {{ shortenAddress(row.address) }}
                </span>
              </div>
            </RouterLink>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Camera, Edit3, Share2, ExternalLink } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Jazzicon } from '@/components/ui/avatar';
import { shortenAddress } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import type { ProfileStorageData } from './types';
import type { NetworkConfig } from '@goton/shared-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFollows, type FollowRow } from '@/composables/useFollows';
import { useWallet } from '@/composables/useWallet';

const { t } = useI18n();

const props = defineProps<{
  profileAddress: string | null;
  isOwnProfile: boolean;
  profileData: ProfileStorageData;
  resolvedAvatarUrl: string;
  resolvedBannerUrl?: string;
  activeNetwork: NetworkConfig;
  copiedShare: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'share'): void;
}>();

const { account, openWallet } = useWallet();
const { stats, busy, error: followError, load, toggle, list } = useFollows();

watch(
  () => [props.profileAddress, account.value] as const,
  ([address, viewer]) => {
    if (address) void load(address, viewer);
  },
  { immediate: true },
);

async function onFollow() {
  if (!props.profileAddress) return;
  if (!account.value) {
    await openWallet();
    return;
  }
  await toggle(props.profileAddress, account.value);
}

const listOpen = ref(false);
const listDirection = ref<'followers' | 'following'>('followers');
const listRows = ref<FollowRow[]>([]);
async function openList(direction: 'followers' | 'following') {
  if (!props.profileAddress) return;
  listDirection.value = direction;
  listRows.value = [];
  listOpen.value = true;
  listRows.value = await list(props.profileAddress, direction);
}
</script>
