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
      <div
        v-else
        class="absolute inset-0 bg-black"
      />

      <div
        v-if="isOwnProfile"
        class="absolute inset-0 bg-background/50 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Update header banner"
      >
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-card text-foreground shadow-xs border border-border">
          <Camera class="w-3.5 h-3.5 text-primary" />
          Update Banner
        </span>
      </div>

      <div class="absolute top-3 right-3 flex items-center gap-2 z-20">
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-background/80 backdrop-blur-md border border-border/80 text-foreground"
        >
          <img
            :src="activeNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
            :alt="activeNetwork.name"
            class="w-3.5 h-3.5 object-contain"
          />
          {{ activeNetwork.name }}
        </span>
      </div>
    </div>

    <!-- 2. Profile Details & Avatar Overlay -->
    <div class="px-5 pb-5 sm:px-7 sm:pb-7 pt-0 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-14">
        <!-- Avatar -->
        <div
          class="relative group w-20 h-20 sm:w-28 sm:h-28 rounded-full ring-4 ring-card bg-card overflow-hidden shrink-0 shadow-xl"
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
            v-if="isOwnProfile"
            variant="outline"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted text-foreground cursor-pointer rounded-xl font-mono"
            @click="emit('edit')"
          >
            <Edit3 class="w-3.5 h-3.5" />
            Edit Profile
          </Button>

          <Button
            variant="default"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 font-bold cursor-pointer rounded-xl font-mono"
            @click="emit('share')"
          >
            <Share2 class="w-3.5 h-3.5" />
            {{ copiedShare ? 'Copied Link!' : 'Share Profile' }}
          </Button>
        </div>
      </div>

      <!-- Identity & Bio -->
      <div class="space-y-1.5 pt-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-foreground font-mono">
            {{
              profileData.displayName ||
              (profileAddress ? getUserIdentity(profileAddress).displayName : 'Anonymous Creator')
            }}
          </h1>
          <CheckCircle2 class="w-5 h-5 fill-primary text-background shrink-0" />
        </div>

        <p class="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
          <span>@{{ profileAddress ? getUserIdentity(profileAddress).name : 'not-connected' }}</span>
          <span class="text-muted-foreground/40">&middot;</span>
          <span>{{ profileAddress ? shortenAddress(profileAddress, 6, 4) : '' }}</span>
        </p>

        <p class="text-xs sm:text-sm text-foreground/90 max-w-2xl font-sans leading-relaxed">
          {{
            profileData.bio ||
            'Non-custodial creator and alpha trader on Proto multi-chain launchpad.'
          }}
        </p>

        <!-- Metadata Ribbon: Social Handles & Block Explorer -->
        <div class="flex items-center gap-4 pt-1 text-xs text-muted-foreground flex-wrap font-mono">
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
            <span>Explorer</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Camera, Edit3, Share2, CheckCircle2, ExternalLink } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Jazzicon } from '@/components/ui/avatar';
import { shortenAddress } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import type { ProfileStorageData } from './types';
import type { NetworkConfig } from '@proto/shared-types';

defineProps<{
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
</script>
