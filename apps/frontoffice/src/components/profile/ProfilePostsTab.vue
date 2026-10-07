<template>
  <div class="space-y-4 font-mono text-xs">
    <!-- Loading State -->
    <div v-if="loading" class="py-16 text-center text-muted-foreground">
      <Loader2 class="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
      <span>Loading posts...</span>
    </div>

    <!-- Empty State -->
    <Empty
      v-else-if="posts.length === 0"
      title="No posts yet"
      :description="
        isOwnProfile
          ? 'You haven\'t posted any alpha calls yet. Share your high-conviction calls with the community!'
          : 'This user hasn\'t posted any calls yet.'
      "
      class="py-14"
    >
      <template #icon>
        <MessageSquare class="w-6 h-6" />
      </template>
    </Empty>

    <!-- Posts Stream -->
    <div v-else class="space-y-3.5">
      <article
        v-for="call in posts"
        :key="call.id"
        class="rounded-2xl border border-border/80 bg-card/80 hover:border-foreground/30 transition p-4 sm:p-5 space-y-3 shadow-2xs relative"
      >
        <!-- Card Header: Author + Verified + Time -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <Jazzicon :address="call.authorAddress" :size="32" class="rounded-full ring-1 ring-border shrink-0" />
            <div class="min-w-0 leading-tight">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-foreground text-xs truncate">
                  {{ shortenAddress(call.authorAddress, 6, 4) }}
                </span>
                <CheckCircle2 class="w-3.5 h-3.5 fill-primary text-background shrink-0" />
                <Badge
                  v-if="isWhaleCaller(call)"
                  variant="outline"
                  class="text-[9px] px-1.5 py-0 h-4 bg-indigo-500/10 text-indigo-400 border-indigo-500/30 font-bold"
                >
                  WHALE
                </Badge>
              </div>
              <span class="text-[10px] text-muted-foreground">Verified Caller</span>
            </div>
          </div>

          <span class="text-[10px] text-muted-foreground">
            {{ formatRelativeTime(call.createdAt) }}
          </span>
        </div>

        <!-- Post Content with Cashtags -->
        <p class="text-xs sm:text-sm leading-relaxed text-foreground font-sans font-medium whitespace-pre-wrap break-words">
          <CashtagText :text="call.content" :tokens="allTokens" />
        </p>

        <!-- Attached Image (if any) -->
        <div
          v-if="call.imageUrl"
          class="rounded-xl overflow-hidden border border-border/60 max-h-72 cursor-pointer bg-muted/20"
          @click="openImage(call.imageUrl)"
        >
          <img :src="resolveSafeUrl(call.imageUrl)" alt="Attachment" class="w-full h-full object-cover" />
        </div>

        <!-- Embedded Mini Coin Widget Card -->
        <div
          class="p-3.5 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/60 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
          @click="emit('navigate-token', call.tokenAddress)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <OptimizedImage
              :src="call.tokenLogo"
              :alt="call.tokenName || 'Token'"
              :fallback-text="call.tokenSymbol || 'TOK'"
              :width="32"
              :height="32"
              class="rounded-full border border-border shrink-0"
            />
            <div class="min-w-0 leading-tight space-y-0.5">
              <div class="flex items-center gap-1.5">
                <span class="font-black text-foreground text-xs sm:text-sm">
                  ${{ call.tokenSymbol || 'TOKEN' }}
                </span>
                <!-- GMGN Chain Badge -->
                <span
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-mono font-bold"
                  :class="
                    getTokenNetwork(call.tokenAddress).chainId === 5042
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  "
                >
                  <img
                    :src="getTokenNetwork(call.tokenAddress).chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
                    :alt="getTokenNetwork(call.tokenAddress).name"
                    class="w-2.5 h-2.5 object-contain"
                  />
                  {{ getTokenNetwork(call.tokenAddress).chainId === 5042 ? 'ARC' : 'RH' }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>MC: <strong class="text-foreground">${{ formatCompactUsd(call.tokenMarketCapUsd ?? 4200) }}</strong></span>
                <span v-if="call.targetMcap" class="text-emerald-500 font-bold truncate">
                  Target: {{ call.targetMcap }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 shrink-0 text-right">
            <div>
              <span class="text-[9px] text-muted-foreground block uppercase font-bold">Position</span>
              <span class="text-xs font-bold text-foreground">
                {{ call.positionUsd ? `$${call.positionUsd.toFixed(1)}` : 'Holding' }}
              </span>
            </div>
            <Button
              size="sm"
              class="h-7 px-3 text-xs font-bold rounded-lg cursor-pointer bg-primary text-primary-foreground"
              @click.stop="emit('navigate-token', call.tokenAddress)"
            >
              Trade
            </Button>
          </div>
        </div>

        <!-- Post Actions Bar -->
        <div class="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground font-mono">
          <!-- 1. Reply -->
          <button
            type="button"
            class="flex items-center gap-1.5 hover:text-foreground transition cursor-pointer select-none"
            @click="emit('reply', call)"
          >
            <MessageCircle class="w-3.5 h-3.5" />
            <span>{{ call.repliesCount || 0 }}</span>
          </button>

          <!-- 2. Repost & Quote Dropdown -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="flex items-center gap-1.5 hover:text-emerald-500 transition cursor-pointer select-none"
                :class="call.isRepostedByViewer ? 'text-emerald-500 font-bold' : ''"
              >
                <Repeat class="w-3.5 h-3.5" />
                <span>{{ (call.repostsCount || 0) + (call.quotesCount || 0) }}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" class="w-36 font-mono text-xs">
              <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('repost', call.id)">
                <Repeat class="w-3.5 h-3.5 text-emerald-500" />
                <span>{{ call.isRepostedByViewer ? 'Undo Repost' : 'Repost' }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer gap-2" @click="emit('quote', call)">
                <Quote class="w-3.5 h-3.5 text-primary" />
                <span>Quote</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- 3. Like -->
          <button
            type="button"
            class="flex items-center gap-1.5 hover:text-rose-500 transition cursor-pointer select-none"
            :class="call.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
            @click="emit('like', call.id)"
          >
            <Heart
              class="w-3.5 h-3.5"
              :class="call.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
            />
            <span>{{ call.likesCount }}</span>
          </button>

          <!-- 4. Total Views -->
          <div class="flex items-center gap-1 text-muted-foreground select-none cursor-default" title="Views">
            <BarChart2 class="w-3.5 h-3.5 opacity-70" />
            <span>{{ formatViews(call.viewsCount || 0) }}</span>
          </div>

          <!-- 5. Share -->
          <button
            type="button"
            class="flex items-center gap-1 hover:text-foreground transition cursor-pointer select-none"
            @click="emit('share', call)"
          >
            <Share2 class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Share</span>
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Loader2,
  MessageSquare,
  MessageCircle,
  Repeat,
  Quote,
  Heart,
  BarChart2,
  Share2,
  CheckCircle2,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Jazzicon } from '@/components/ui/avatar';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { CashtagText } from '@/components/feed';
import { isWhaleCaller } from '@/composables/useFeed';
import { useTokenStore, type TokenListItem } from '@/composables/useTokenStore';
import { shortenAddress, formatRelativeTime, formatCompactUsd } from '@/lib/utils';
import type { FeedCalloutItem } from '@proto/shared-types';

defineProps<{
  posts: FeedCalloutItem[];
  loading: boolean;
  isOwnProfile: boolean;
  allTokens?: ReadonlyArray<TokenListItem>;
}>();

const emit = defineEmits<{
  (e: 'reply', call: FeedCalloutItem): void;
  (e: 'quote', call: FeedCalloutItem): void;
  (e: 'like', callId: string): void;
  (e: 'repost', callId: string): void;
  (e: 'share', call: FeedCalloutItem): void;
  (e: 'navigate-token', address: string): void;
}>();

const { getTokenNetwork } = useTokenStore();

function formatViews(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val || 0);
}

function resolveSafeUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('ipfs://')) {
    const hash = trimmed.replace('ipfs://', '');
    return `/api/ipfs/${hash}`;
  }
  return trimmed;
}

function openImage(url?: string): void {
  if (url && typeof window !== 'undefined') {
    window.open(resolveSafeUrl(url), '_blank', 'noopener,noreferrer');
  }
}
</script>
