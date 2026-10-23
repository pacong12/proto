<template>
  <div class="max-h-[460px] overflow-y-auto p-4 sm:p-5 space-y-4">
    <!-- Quick Post Callout Action -->
    <div
      class="p-4 rounded-2xl border border-border bg-black flex items-center justify-between gap-3 text-xs"
    >
      <div class="flex items-center gap-2 min-w-0">
        <Megaphone class="w-4 h-4 text-primary shrink-0" />
        <div class="min-w-0">
          <p class="font-bold text-foreground text-xs leading-tight">Post a Community Callout</p>
          <p class="text-xs text-muted-foreground truncate">
            Attach your thesis, exit price target, and verified position.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        class="h-8 px-3 text-xs font-bold gap-1.5 cursor-pointer shrink-0 shadow-2xs"
        @click="$emit('openCallModal')"
      >
        <Megaphone class="w-3 h-3" />
        <span>Call ${{ currentToken.symbol }}</span>
      </Button>
    </div>

    <!-- Callouts Feed -->
    <div
      v-if="calloutsLoading && callouts.length === 0"
      class="py-12 text-center text-muted-foreground"
    >
      <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-primary" />
      <span class="text-xs">Loading callouts...</span>
    </div>
    <Empty
      v-else-if="callouts.length === 0"
      :title="'No callouts yet'"
      :description="`Be the first to call $${currentToken.symbol} to the community!`"
      class="py-12 border border-dashed border-border bg-black"
    >
      <template #icon>
        <Megaphone class="w-6 h-6 text-muted-foreground opacity-60" />
      </template>
    </Empty>
    <div v-else class="space-y-3">
      <div
        v-for="cmt in paginatedCallouts"
        :key="cmt.id"
        class="p-3.5 rounded-xl border border-border bg-black hover:bg-zinc-950 transition-colors space-y-2.5"
      >
        <!-- Header: Author + Badges + Time -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Jazzicon :address="cmt.authorAddress" :size="18" />
            <RouterLink
              :to="'/' + getUserIdentity(cmt.authorAddress).name"
              class="text-xs font-bold text-foreground hover:underline"
            >
              {{ getUserIdentity(cmt.authorAddress).displayName }}
            </RouterLink>
            <Badge
              v-if="cmt.authorAddress.toLowerCase() === currentToken.deployer?.toLowerCase()"
              variant="secondary"
              class="text-xs px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            >
              Creator
            </Badge>
            <Badge
              v-else-if="isHolderAddress(cmt.authorAddress)"
              variant="outline"
              class="text-xs px-1.5 py-0 h-4 text-muted-foreground"
            >
              Holder
            </Badge>
          </div>
          <span class="text-xs text-muted-foreground">
            {{ formatRelativeTime(cmt.createdAt) }}
          </span>
        </div>

        <!-- Callout Text -->
        <p
          class="text-xs leading-relaxed text-foreground font-sans break-words whitespace-pre-wrap font-medium"
        >
          <CashtagText :text="cmt.content" :tokens="[{ token: currentToken }]" />
        </p>

        <!-- Optional Attached Image -->
        <div v-if="cmt.imageUrl" class="rounded-lg overflow-hidden border border-border max-w-xs">
          <img
            :src="resolveSafeUrl(cmt.imageUrl)"
            alt="Call attachment"
            class="w-full max-h-48 object-cover"
          />
        </div>

        <!-- Pump.fun Style Callout Mini Token Card -->
        <div
          class="p-2.5 rounded-xl border border-border bg-black flex items-center justify-between gap-3 text-xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <OptimizedImage
              :src="currentToken.logo"
              :alt="currentToken.name"
              :fallback-text="currentToken.symbol"
              :width="26"
              :height="26"
              class="rounded-md border border-border shrink-0"
            />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 leading-none">
                <span class="font-bold text-foreground text-xs">${{ currentToken.symbol }}</span>
                <span class="text-xs text-muted-foreground truncate">{{ currentToken.name }}</span>
              </div>
              <span class="text-xs text-emerald-500 font-bold block mt-1">
                {{
                  cmt.targetMcap
                    ? `Target: ${cmt.targetMcap}`
                    : `MC: ${formatMarketCap(currentMarketData.marketCapUsd)}`
                }}
              </span>
            </div>
          </div>

          <div class="text-right shrink-0">
            <span class="text-xs text-muted-foreground block uppercase font-bold">Position</span>
            <span class="text-xs font-bold text-foreground">
              {{ cmt.positionUsd ? `$${cmt.positionUsd.toFixed(2)}` : 'Holder' }}
            </span>
          </div>
        </div>

        <!-- Card Actions: Thread Replies + Like + Total Views + Share Sheet (Twitter/X style) -->
        <div
          class="flex items-center justify-between pt-1 border-t border-border text-xs font-sans text-muted-foreground"
        >
          <button
            type="button"
            class="group flex items-center gap-1 hover:text-sky-500 transition-colors cursor-pointer text-xs"
            title="View replies"
            @click="$emit('openThreadModal', cmt)"
          >
            <div class="p-1 rounded-full group-hover:bg-sky-500/10 transition-colors">
              <MessageCircle class="w-3.5 h-3.5" />
            </div>
            <span class="group-hover:text-sky-500">{{ cmt.repliesCount || 0 }}</span>
          </button>

          <button
            type="button"
            aria-label="Like callout"
            class="group flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer text-xs"
            :class="cmt.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
            @click="$emit('toggleLike', cmt.id)"
          >
            <div class="p-1 rounded-full group-hover:bg-rose-500/10 transition-colors">
              <Heart
                class="w-3.5 h-3.5"
                :class="cmt.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
              />
            </div>
            <span class="group-hover:text-rose-500">{{ cmt.likesCount }}</span>
          </button>

          <!-- Total Views (Display only, strictly NOT clickable, Twitter / X style) -->
          <div
            class="flex items-center gap-1 text-muted-foreground select-none cursor-default text-xs"
            title="Views"
          >
            <div class="p-1">
              <BarChart2 class="w-3.5 h-3.5 text-muted-foreground/70" />
            </div>
            <span>{{ formatViews(cmt.viewsCount || 0) }}</span>
          </div>

          <button
            type="button"
            class="group flex items-center text-muted-foreground hover:text-sky-500 transition-colors cursor-pointer text-xs"
            title="Share callout"
            @click="$emit('openShareModal', cmt)"
          >
            <div class="p-1 rounded-full group-hover:bg-sky-500/10 transition-colors">
              <Share2 class="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>

      <!-- Callouts Pagination -->
      <div v-if="callouts.length > calloutsPageSize" class="pt-2 flex justify-center">
        <Pagination
          :total="callouts.length"
          :items-per-page="calloutsPageSize"
          :page="calloutsPage"
          @update:page="$emit('update:calloutsPage', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Megaphone, Loader2, MessageCircle, Heart, BarChart2, Share2 } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Pagination } from '@/components/ui/pagination';
import { Jazzicon } from '@/components/ui/avatar';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { CashtagText } from '@/components/feed';
import { formatRelativeTime, formatMarketCap } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import type { LaunchedTokenEntity, TokenMarketData, TokenCommentEntity } from '@goton/shared-types';

interface Props {
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  callouts: TokenCommentEntity[];
  paginatedCallouts: TokenCommentEntity[];
  calloutsLoading: boolean;
  calloutsPage: number;
  calloutsPageSize: number;
  isHolderAddress: (addr: string) => boolean;
  resolveSafeUrl: (url?: string) => string;
  formatViews: (val: number) => string;
}

defineProps<Props>();

const { t } = useI18n();

defineEmits<{
  (e: 'openCallModal'): void;
  (e: 'openThreadModal', cmt: TokenCommentEntity): void;
  (e: 'openShareModal', cmt: TokenCommentEntity): void;
  (e: 'toggleLike', id: string): void;
  (e: 'update:calloutsPage', page: number): void;
}>();
</script>
