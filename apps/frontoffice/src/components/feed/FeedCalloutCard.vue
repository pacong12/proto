<template>
  <article
    class="rounded-2xl border border-border/80 bg-card/80 hover:border-foreground/30 hover:bg-card/95 transition-all p-4 sm:p-5 space-y-3 shadow-2xs relative group"
  >
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
              class="font-bold text-foreground text-xs sm:text-sm hover:underline cursor-pointer"
              @click.stop="$emit('navigateToCaller', call.authorAddress)"
            >
              {{ getUserIdentity(call.authorAddress).displayName }}
            </span>

            <!-- Caller Whale Badge with GMGN/Web3Icons SVG -->
            <TraderTagBadge v-if="isWhaleCaller(call)" tag="whale" size="sm" />
          </div>
          <span class="text-[10px] text-muted-foreground"> Verified Caller </span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[10px] text-muted-foreground">
          {{ formatRelativeTime(call.createdAt) }}
        </span>
      </div>
    </div>

    <!-- Post Message Text with Styled Interactive Cashtags -->
    <p
      class="text-xs sm:text-sm leading-relaxed text-foreground font-sans font-medium whitespace-pre-wrap break-words"
    >
      <CashtagText :text="call.content" :tokens="allTokens" />
    </p>

    <!-- Quoted Callout Embed (Twitter / Pump.fun Hybrid Quote) -->
    <div
      v-if="call.quotedCallout"
      class="rounded-xl border border-border p-3 bg-black hover:bg-zinc-950 transition text-xs space-y-1.5 cursor-pointer"
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
        <span class="text-muted-foreground text-[10px]">&middot;</span>
        <span class="text-[10px] text-muted-foreground">
          {{ formatRelativeTime(call.quotedCallout.createdAt) }}
        </span>
      </div>
      <p class="text-xs text-muted-foreground font-sans">
        <CashtagText :text="call.quotedCallout.content" :tokens="allTokens" />
      </p>
    </div>

    <!-- Attached Media Image -->
    <div
      v-if="call.imageUrl"
      class="rounded-xl overflow-hidden border border-border max-h-72 cursor-pointer bg-black"
      @click.stop="$emit('openImage', call.imageUrl)"
    >
      <img
        :src="resolveSafeUrl(call.imageUrl)"
        alt="Attachment"
        class="w-full h-full object-cover hover:scale-[1.01] transition-transform"
      />
    </div>

    <!-- Signature Web3 Token Card Widget -->
    <div
      class="p-3.5 rounded-xl border border-border bg-black hover:bg-zinc-950 transition cursor-pointer flex items-center justify-between gap-3 text-xs shadow-2xs"
      @click.stop="$emit('navigateToToken', call.tokenAddress)"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- Token Logo with Chain Icon directly attached to corner -->
        <div class="relative shrink-0">
          <OptimizedImage
            :src="call.tokenLogo"
            :alt="call.tokenName || 'Token'"
            :fallback-text="call.tokenSymbol || 'TOK'"
            :width="36"
            :height="36"
            class="rounded-full border border-border/70 shrink-0 shadow-2xs"
          />
          <img
            :src="getChainIcon(call.tokenAddress)"
            :alt="getChainName(call.tokenAddress)"
            :title="getChainName(call.tokenAddress)"
            class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black bg-black object-contain shadow-xs"
          />
        </div>

        <div class="min-w-0 leading-tight space-y-0.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-black text-foreground text-xs sm:text-sm">
              ${{ call.tokenSymbol || 'TOKEN' }}
            </span>
            <button
              type="button"
              class="p-0.5 rounded transition-transform hover:scale-110 cursor-pointer select-none"
              :class="
                isPinned(call.tokenAddress)
                  ? 'text-amber-400'
                  : 'text-muted-foreground/35 hover:text-amber-400'
              "
              :title="isPinned(call.tokenAddress) ? 'Unpin coin' : 'Pin to Watchlist'"
              @click.stop="$emit('togglePin', call.tokenAddress)"
            >
              <Star
                class="w-3.5 h-3.5"
                :class="isPinned(call.tokenAddress) ? 'fill-amber-400 text-amber-400' : ''"
              />
            </button>
            <span class="text-[10px] text-muted-foreground truncate hidden sm:inline font-sans">
              {{ call.tokenName }}
            </span>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span
              >MC:
              <strong class="text-foreground"
                >${{ formatCompactUsd(call.tokenMarketCapUsd ?? 4200) }}</strong
              ></span
            >
            <span v-if="call.targetMcap" class="text-emerald-500 font-bold truncate">
              Target: {{ call.targetMcap }}
            </span>
          </div>
        </div>
      </div>

      <!-- Caller Financial Position + Live PnL Badge -->
      <div class="flex items-center gap-2 shrink-0 text-right">
        <!-- PnL badge: show when priceAtPost + tokenPriceUsd both available -->
        <div
          v-if="
            call.priceAtPost && call.priceAtPost > 0 && call.tokenPriceUsd && call.tokenPriceUsd > 0
          "
          class="flex flex-col items-end gap-0.5"
          :title="`Entry price: $${call.priceAtPost.toPrecision(4)} → Current: $${call.tokenPriceUsd.toPrecision(4)}`"
        >
          <!-- Live PnL % row -->
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums border"
            :class="
              callPnlPct(call) >= 0
                ? 'bg-emerald-950/60 border-emerald-700/40 text-emerald-400'
                : 'bg-rose-950/60 border-rose-700/40 text-rose-400'
            "
          >
            <TrendingUp v-if="callPnlPct(call) >= 0" class="w-3 h-3" />
            <TrendingDown v-else class="w-3 h-3" />
            {{ callPnlPct(call) >= 0 ? '+' : '' }}{{ callPnlPct(call).toFixed(1) }}%
          </span>
          <!-- Position size + abs PnL row -->
          <span class="text-[9px] text-muted-foreground tabular-nums leading-none">
            <span v-if="call.positionUsd && call.positionUsd > 0">
              ${{ formatCompactUsd(call.positionUsd) }}
            </span>
            <span
              v-if="callPnlUsd(call) !== null"
              :class="callPnlUsd(call)! >= 0 ? 'text-emerald-500' : 'text-rose-500'"
            >
              {{ call.positionUsd ? ' · ' : '' }}{{ callPnlUsd(call)! >= 0 ? '+' : '' }}${{
                callPnlUsd(call)!.toFixed(1)
              }}
            </span>
          </span>
        </div>

        <!-- Fallback: plain position + profit when no priceAtPost -->
        <div
          v-else-if="call.positionUsd || call.profitUsd !== undefined"
          class="flex flex-col items-end gap-0.5"
        >
          <span v-if="call.positionUsd" class="text-xs font-bold text-foreground">
            ${{ formatCompactUsd(call.positionUsd) }}
          </span>
          <span
            v-if="call.profitUsd !== undefined"
            class="text-[11px] font-bold"
            :class="call.profitUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'"
          >
            {{ call.profitUsd >= 0 ? '+' : '' }}${{ call.profitUsd.toFixed(1) }}
          </span>
        </div>

        <Button
          size="sm"
          class="h-7 px-3 text-xs font-bold rounded-lg cursor-pointer bg-primary text-primary-foreground hover:opacity-90 shadow-2xs"
          @click.stop="$emit('navigateToToken', call.tokenAddress)"
        >
          Trade
        </Button>
      </div>
    </div>

    <!-- Hybrid Social Action Bar -->
    <div
      class="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground"
      @click.stop
    >
      <!-- 1. Reply / Thread -->
      <button
        type="button"
        class="flex items-center gap-1.5 hover:text-foreground transition cursor-pointer select-none"
        title="View discussion thread & replies"
        @click="$emit('openThread', call)"
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
            title="Repost or Quote"
          >
            <Repeat class="w-3.5 h-3.5" />
            <span>{{ (call.repostsCount || 0) + (call.quotesCount || 0) }}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" class="w-36 text-xs">
          <DropdownMenuItem class="cursor-pointer gap-2" @click="$emit('toggleRepost', call.id)">
            <Repeat class="w-3.5 h-3.5 text-emerald-500" />
            <span>{{ call.isRepostedByViewer ? 'Undo Repost' : 'Repost' }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer gap-2" @click="$emit('openQuote', call)">
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
        title="Like"
        @click="$emit('toggleLike', call.id)"
      >
        <Heart
          class="w-3.5 h-3.5"
          :class="call.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
        />
        <span>{{ call.likesCount }}</span>
      </button>

      <!-- 4. Total Views (Display only, strictly NOT clickable) -->
      <div
        class="flex items-center gap-1.5 text-muted-foreground select-none cursor-default"
        title="Total impressions & views"
      >
        <BarChart2 class="w-3.5 h-3.5 opacity-70" />
        <span>{{ formatViews(call.viewsCount || 0) }}</span>
      </div>

      <!-- 5. Share Sheet -->
      <button
        type="button"
        class="flex items-center gap-1 hover:text-foreground transition cursor-pointer select-none"
        title="Share Sheet"
        @click="$emit('openShare', call)"
      >
        <Share2 class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">Share</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  Heart,
  Repeat,
  Quote,
  Share2,
  BarChart2,
  MessageCircle,
  Star,
  TrendingUp,
  TrendingDown,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { TraderTagBadge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Jazzicon } from '@/components/ui/avatar';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import CashtagText from './CashtagText.vue';
import { isWhaleCaller } from '@/composables/useFeed';
import { useTokenStore } from '@/composables/useTokenStore';
import { formatRelativeTime, formatCompactUsd } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { calculateUnrealizedPnl } from '@proto/math-sdk';
import type { FeedCalloutItem } from '@proto/shared-types';

interface Props {
  call: FeedCalloutItem;
  allTokens?: readonly any[] | any[];
  isPinned: (address: string) => boolean;
}

const props = withDefaults(defineProps<Props>(), {
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
const { getTokenNetwork } = useTokenStore();

function getChainIcon(tokenAddress: string): string {
  const net = getTokenNetwork(tokenAddress);
  return net.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg';
}

function getChainName(tokenAddress: string): string {
  const net = getTokenNetwork(tokenAddress);
  return net.name;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

function resolveSafeUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  return url;
}

function callPnlPct(call: FeedCalloutItem): number {
  return calculateUnrealizedPnl(call.priceAtPost ?? 0, call.tokenPriceUsd ?? 0).pnlPct;
}

function callPnlUsd(call: FeedCalloutItem): number | null {
  return calculateUnrealizedPnl(call.priceAtPost ?? 0, call.tokenPriceUsd ?? 0, call.positionUsd)
    .pnlUsd;
}
</script>
