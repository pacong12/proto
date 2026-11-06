<template>
  <Card class="p-4 space-y-3 hover:shadow-sm">
    <!-- Card Header: Author + Badges + Timestamp + More Menu -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2.5 min-w-0">
        <Jazzicon
          :address="call.authorAddress"
          :size="36"
          class="rounded-full ring-1 ring-border shrink-0 cursor-pointer"
          @click.stop="$emit('navigateToCaller', call.authorAddress)"
        />
        <div class="min-w-0 leading-tight">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span
              class="font-bold text-foreground text-sm sm:text-base hover:underline cursor-pointer"
              @click.stop="$emit('navigateToCaller', call.authorAddress)"
            >
              {{ getUserIdentity(call.authorAddress).displayName }}
            </span>

            <!-- Caller Whale Badge with GMGN/Web3Icons SVG -->
            <TraderTagBadge v-if="isWhaleCaller(call)" tag="whale" size="sm" />
          </div>
          <!-- Every call needs a signature and an on-chain holding, so state the holding itself. -->
          <span class="text-xs text-muted-foreground">
            {{ holdingLabel(call) }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-muted-foreground">
          {{ formatRelativeTime(call.createdAt) }}
        </span>
      </div>
    </div>

    <!-- Post Message Text with Styled Interactive Cashtags -->
    <p
      class="text-sm sm:text-base leading-relaxed text-foreground font-sans font-medium whitespace-pre-wrap break-words"
    >
      <CashtagText :text="call.content" :tokens="allTokens" />
    </p>

    <!-- Quoted Callout Embed (Twitter / Pump.fun Hybrid Quote) -->
    <div
      v-if="call.quotedCallout"
      class="rounded-xl border border-border p-3 bg-muted/40 hover:bg-muted transition text-sm space-y-1.5 cursor-pointer"
      @click.stop="router.push(`/post/${call.quotedCallout.id}`)"
    >
      <div class="flex items-center gap-1.5">
        <Jazzicon :address="call.quotedCallout.authorAddress" :size="16" class="rounded-full" />
        <span class="font-bold text-foreground">
          {{ getUserIdentity(call.quotedCallout.authorAddress).displayName }}
        </span>
        <span v-if="call.quotedCallout.tokenSymbol" class="text-primary font-bold">
          ${{ call.quotedCallout.tokenSymbol }}
        </span>
        <span class="text-muted-foreground text-xs">&middot;</span>
        <span class="text-xs text-muted-foreground">
          {{ formatRelativeTime(call.quotedCallout.createdAt) }}
        </span>
      </div>
      <p class="text-sm text-muted-foreground font-sans">
        <CashtagText :text="call.quotedCallout.content" :tokens="allTokens" />
      </p>
    </div>

    <!-- Attached Media Image -->
    <div
      v-if="call.imageUrl"
      class="rounded-xl overflow-hidden border border-border max-h-72 cursor-pointer bg-muted"
      @click.stop="$emit('openImage', call.imageUrl)"
    >
      <img
        :src="resolveSafeUrl(call.imageUrl)"
        alt="Attachment"
        class="w-full h-full object-cover hover:scale-[1.01] transition-transform"
      />
    </div>

    <FeedCalloutTokenPanel
      :call="call"
      :pinned="isPinned(call.tokenAddress)"
      @navigate-to-token="$emit('navigateToToken', $event)"
      @toggle-pin="$emit('togglePin', $event)"
    />

    <!-- Hybrid Social Action Bar -->
    <div
      class="flex items-center justify-between -mx-2 -mb-1 text-xs text-muted-foreground"
      @click.stop
    >
      <!-- 1. Reply / Thread -->
      <Button
        variant="ghost"
        size="sm"
        class="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        title="View discussion thread & replies"
        @click="$emit('openThread', call)"
      >
        <MessageCircle class="w-3.5 h-3.5" />
        <span>{{ call.repliesCount || 0 }}</span>
      </Button>

      <!-- 2. Repost & Quote Dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            :class="call.isRepostedByViewer ? 'text-foreground font-bold' : ''"
            title="Repost or Quote"
          >
            <Repeat class="w-3.5 h-3.5" />
            <span>{{ (call.repostsCount || 0) + (call.quotesCount || 0) }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" class="w-36 text-xs">
          <DropdownMenuItem class="cursor-pointer gap-2" @click="$emit('toggleRepost', call.id)">
            <Repeat class="w-3.5 h-3.5 text-foreground" />
            <span>{{ call.isRepostedByViewer ? t('undoRepost') : t('repost') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer gap-2" @click="$emit('openQuote', call)">
            <Quote class="w-3.5 h-3.5 text-foreground" />
            <span>{{ t('quote') }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- 3. Like -->
      <Button
        variant="ghost"
        size="sm"
        class="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        :class="call.isLikedByViewer ? 'text-foreground font-bold' : ''"
        title="Like"
        @click="$emit('toggleLike', call.id)"
      >
        <Heart
          class="w-3.5 h-3.5"
          :class="call.isLikedByViewer ? 'fill-foreground text-foreground' : ''"
        />
        <span>{{ call.likesCount }}</span>
      </Button>

      <!-- 4. Total Views (Display only, strictly NOT clickable) -->
      <div
        class="flex items-center gap-1.5 px-2 text-muted-foreground select-none cursor-default"
        title="Total impressions & views"
      >
        <BarChart2 class="w-3.5 h-3.5 opacity-70" />
        <span>{{ formatViews(call.viewsCount || 0) }}</span>
      </div>

      <!-- 5. Share Sheet -->
      <Button
        variant="ghost"
        size="sm"
        class="h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        title="Share Sheet"
        @click="$emit('openShare', call)"
      >
        <Share2 class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">Share</span>
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { resolveSafeUrl } from '@/lib/safe-url';
import { useRouter } from 'vue-router';
import { Heart, Repeat, Quote, Share2, BarChart2, MessageCircle } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TraderTagBadge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Jazzicon } from '@/components/ui/avatar';
import CashtagText, { type CashtagToken } from './CashtagText.vue';
import FeedCalloutTokenPanel from './FeedCalloutTokenPanel.vue';
import { isWhaleCaller } from '@/composables/useFeed';
import { formatRelativeTime } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import type { FeedCalloutItem } from '@goton/shared-types';

interface Props {
  call: FeedCalloutItem;
  allTokens?: ReadonlyArray<CashtagToken>;
  isPinned: (address: string) => boolean;
}

withDefaults(defineProps<Props>(), {
  allTokens: () => [],
});

defineEmits<{
  (e: 'navigateToCaller', address: string): void;
  (e: 'navigateToToken', address: string): void;
  (e: 'openThread', call: FeedCalloutItem): void;
  (e: 'openQuote', call: FeedCalloutItem): void;
  (e: 'openShare', call: FeedCalloutItem): void;
  (e: 'toggleLike', id: string): void;
  (e: 'toggleRepost', id: string): void;
  (e: 'togglePin', address: string): void;
  (e: 'openImage', url: string): void;
}>();

const router = useRouter();
const { t } = useI18n();

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

/** The caller's share of supply when they posted (every call is checked on-chain). */
function holdingLabel(c: { supplyPercent?: number }): string {
  const pct = c.supplyPercent ?? 0;
  if (pct <= 0) return 'Holder at call';
  return `Held ${pct < 0.01 ? '<0.01' : pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}% of supply at call`;
}
</script>
