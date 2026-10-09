<template>
  <div class="max-w-2xl mx-auto space-y-4 pb-16 font-sans">
    <!-- 1. Sticky Hybrid Header -->
    <header
      class="sticky top-0 z-30 backdrop-blur-md bg-background/85 border border-border/80 rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xs select-none"
    >
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="p-2 -ml-1 rounded-xl hover:bg-muted text-foreground transition cursor-pointer border border-border/50"
          title="Go back"
          @click="goBack"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <h1 class="text-base font-bold tracking-tight text-foreground leading-none font-mono">
            Alpha Post
          </h1>
          <span class="text-[10px] text-muted-foreground font-mono">
            Community Signal Detail
          </span>
        </div>
      </div>

      <div
        v-if="post"
        class="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-border/60 bg-muted/30 text-muted-foreground font-mono text-xs select-none cursor-default"
        title="Total Impressions"
      >
        <BarChart2 class="w-3.5 h-3.5 text-primary" />
        <span class="font-bold text-foreground">{{ formatViews(post.viewsCount || 0) }}</span>
        <span>Views</span>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="py-24 text-center text-muted-foreground font-mono">
      <Loader2 class="w-7 h-7 animate-spin mx-auto mb-3 text-primary" />
      <p class="text-xs">Loading post details...</p>
    </div>

    <!-- Error / Not Found State -->
    <Empty
      v-else-if="!post"
      title="Post Not Found"
      description="This post may have been removed or the link is invalid."
      class="py-16"
    >
      <template #icon>
        <AlertCircle class="w-6 h-6 text-destructive/70" />
      </template>
      <template #action>
        <Button size="sm" class="rounded-xl px-5 cursor-pointer font-mono" @click="router.push('/feed')">
          Back to Feed
        </Button>
      </template>
    </Empty>

    <!-- Main Post Content (Hybrid Card Detail View) -->
    <div v-else class="space-y-4">
      <!-- The Main Post Card -->
      <article class="rounded-2xl border border-border/80 bg-card/85 p-5 space-y-4 shadow-2xs">
        <!-- Author Row -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <Jazzicon :address="post.authorAddress" :size="44" class="shrink-0 rounded-full ring-1 ring-border" />
            <div class="min-w-0 leading-snug">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  class="font-bold text-foreground text-sm sm:text-base hover:underline cursor-pointer truncate font-mono"
                  @click="router.push(`/${getUserIdentity(post.authorAddress).name}`)"
                >
                  {{ getUserIdentity(post.authorAddress).displayName }}
                </span>
                <TraderTagBadge
                  v-if="isWhaleCaller(post)"
                  tag="whale"
                  size="sm"
                />
              </div>
              <span class="text-xs text-muted-foreground font-mono block truncate">
                @{{ getUserIdentity(post.authorAddress).name }} &middot; {{ shortenAddress(post.authorAddress, 6, 4) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Post Body Text -->
        <p class="text-base sm:text-lg leading-relaxed text-foreground font-sans whitespace-pre-wrap break-words">
          <CashtagText :text="post.content" :tokens="allTokens" />
        </p>

        <!-- Quoted Post Embed (if any) -->
        <div
          v-if="post.quotedCallout"
          class="rounded-xl border border-border/80 p-3.5 bg-muted/20 hover:bg-muted/40 transition cursor-pointer text-xs space-y-1.5"
          @click="router.push(`/post/${post.quotedCallout.id}`)"
        >
          <div class="flex items-center gap-1.5">
            <Jazzicon :address="post.quotedCallout.authorAddress" :size="18" class="rounded-full" />
            <span class="font-bold text-foreground font-mono">
              {{ getUserIdentity(post.quotedCallout.authorAddress).displayName }}
            </span>
            <span v-if="post.quotedCallout.tokenSymbol" class="text-primary font-bold font-mono">
              ${{ post.quotedCallout.tokenSymbol }}
            </span>
            <span class="text-muted-foreground text-[10px]">&middot;</span>
            <span class="text-[10px] text-muted-foreground font-mono">
              {{ formatRelativeTime(post.quotedCallout.createdAt) }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground font-sans">
            <CashtagText :text="post.quotedCallout.content" :tokens="allTokens" />
          </p>
        </div>

        <!-- Attached Media Image -->
        <div
          v-if="post.imageUrl"
          class="rounded-2xl overflow-hidden border border-border/70 max-h-[460px] cursor-pointer bg-muted/20"
          @click="openImage(post.imageUrl)"
        >
          <img :src="resolveSafeUrl(post.imageUrl)" alt="Attachment" class="w-full h-full object-cover" />
        </div>

        <!-- Embedded Coin Widget Card -->
        <div
          class="p-3.5 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/60 transition cursor-pointer flex items-center justify-between gap-3 text-xs font-mono shadow-2xs"
          @click="router.push(`/launchpad/${post.tokenAddress}`)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <OptimizedImage
              :src="post.tokenLogo"
              :alt="post.tokenName || 'Token'"
              :fallback-text="post.tokenSymbol || 'TOK'"
              :width="36"
              :height="36"
              class="rounded-full border border-border/70 shrink-0"
            />
            <div class="min-w-0 leading-tight">
              <div class="flex items-center gap-1.5">
                <span class="font-black text-foreground text-sm">
                  ${{ post.tokenSymbol || 'TOKEN' }}
                </span>
                <span class="text-[10px] text-muted-foreground truncate hidden sm:inline font-sans">
                  {{ post.tokenName }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span>MC: ${{ formatCompactUsd(post.tokenMarketCapUsd || 4200) }}</span>
                <span v-if="post.targetMcap" class="text-emerald-500 font-bold truncate">
                  Target: {{ post.targetMcap }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 shrink-0 text-right">
            <div>
              <span class="text-[9px] text-muted-foreground block uppercase font-bold">Position</span>
              <span class="text-xs font-bold text-foreground">
                {{ post.positionUsd ? `$${post.positionUsd.toFixed(1)}` : 'Holding' }}
              </span>
            </div>
            <Button
              size="sm"
              class="h-7 px-3.5 text-xs font-bold rounded-lg cursor-pointer bg-primary text-primary-foreground"
              @click.stop="router.push(`/launchpad/${post.tokenAddress}`)"
            >
              Trade
            </Button>
          </div>
        </div>

        <!-- Timestamp & Views Ribbon -->
        <div class="pt-2 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap font-mono border-t border-border/50">
          <span>{{ formatAbsoluteTime(post.createdAt) }}</span>
          <span>&middot;</span>
          <span class="font-bold text-foreground">{{ formatViews(post.viewsCount || 0) }}</span>
          <span>Views</span>
        </div>

        <!-- Metrics Ribbon (Reposts, Quotes, Likes) -->
        <div
          v-if="(post.repostsCount || 0) + (post.quotesCount || 0) + post.likesCount > 0"
          class="py-2.5 border-y border-border/60 flex items-center gap-5 text-xs text-muted-foreground font-mono"
        >
          <div v-if="post.repostsCount" class="flex items-center gap-1">
            <strong class="text-foreground">{{ post.repostsCount }}</strong>
            <span>Reposts</span>
          </div>
          <div v-if="post.quotesCount" class="flex items-center gap-1">
            <strong class="text-foreground">{{ post.quotesCount }}</strong>
            <span>Quotes</span>
          </div>
          <div v-if="post.likesCount" class="flex items-center gap-1">
            <strong class="text-foreground">{{ post.likesCount }}</strong>
            <span>Likes</span>
          </div>
        </div>

        <!-- Action Bar (Reply, Repost, Like, Share) -->
        <div class="flex items-center justify-around pt-1 text-muted-foreground border-t border-border/60 font-mono">
          <!-- 1. Reply -->
          <button
            type="button"
            class="flex items-center gap-1.5 p-2 rounded-xl hover:bg-muted hover:text-foreground transition cursor-pointer"
            title="Reply"
            @click="focusReplyInput"
          >
            <MessageCircle class="w-4 h-4" />
            <span class="text-xs">{{ replies.length }}</span>
          </button>

          <!-- 2. Repost & Quote Dropdown -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="flex items-center gap-1.5 p-2 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500 transition cursor-pointer"
                :class="post.isRepostedByViewer ? 'text-emerald-500' : ''"
                title="Repost"
              >
                <Repeat class="w-4 h-4" />
                <span class="text-xs">{{ (post.repostsCount || 0) + (post.quotesCount || 0) }}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" class="w-36 font-mono text-xs">
              <DropdownMenuItem class="cursor-pointer gap-2" @click="handleRepostPost">
                <Repeat class="w-3.5 h-3.5 text-emerald-500" />
                <span>{{ post.isRepostedByViewer ? 'Undo Repost' : 'Repost' }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer gap-2" @click="isQuoteModalOpen = true">
                <Quote class="w-3.5 h-3.5 text-primary" />
                <span>Quote</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- 3. Like -->
          <button
            type="button"
            class="flex items-center gap-1.5 p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
            :class="post.isLikedByViewer ? 'text-rose-500' : ''"
            title="Like"
            @click="handleLikePost"
          >
            <Heart
              class="w-4 h-4"
              :class="post.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
            />
            <span class="text-xs">{{ post.likesCount }}</span>
          </button>

          <!-- 4. Share -->
          <button
            type="button"
            class="flex items-center gap-1.5 p-2 rounded-xl hover:bg-muted hover:text-foreground transition cursor-pointer"
            title="Share"
            @click="isShareModalOpen = true"
          >
            <Share2 class="w-4 h-4" />
          </button>
        </div>
      </article>

      <!-- 2. Reply Composer Card -->
      <div class="rounded-2xl border border-border/80 bg-card/85 p-4 sm:p-5 flex gap-3 sm:gap-3.5 items-start shadow-2xs">
        <Jazzicon
          :address="account || '0x0000000000000000000000000000000000000000'"
          :size="38"
          class="shrink-0 rounded-full mt-0.5 ring-1 ring-border"
        />

        <div class="flex-1 min-w-0 space-y-2.5">
          <textarea
            ref="replyTextarea"
            v-model="replyContent"
            rows="2"
            maxlength="500"
            placeholder="Post your reply... (use $TICKER to link coins)"
            class="w-full text-xs sm:text-sm p-3 rounded-xl border border-border/80 bg-muted/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
          />

          <div class="flex items-center justify-between pt-1">
            <span class="text-[11px] text-muted-foreground font-mono">
              {{ replyContent.length }}/500
            </span>
            <Button
              size="sm"
              class="rounded-xl px-5 h-8 font-bold text-xs cursor-pointer font-mono"
              :disabled="isSubmittingReply || !replyContent.trim()"
              @click="submitReply"
            >
              <Loader2 v-if="isSubmittingReply" class="w-3.5 h-3.5 animate-spin mr-1" />
              <span>Reply</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- 3. Thread Replies Stream (Cards) -->
      <div class="rounded-2xl border border-border/80 bg-card/70 p-4 space-y-3 shadow-2xs">
        <h3 class="font-bold text-xs font-mono text-foreground px-1 flex items-center justify-between">
          <span>Discussion & Replies ({{ replies.length }})</span>
        </h3>

        <Empty
          v-if="replies.length === 0"
          title="No replies yet"
          description="Start the conversation by posting a reply above!"
          class="py-10 border-none bg-muted/20"
        >
          <template #icon>
            <MessageCircle class="w-6 h-6 text-muted-foreground opacity-60" />
          </template>
        </Empty>

        <div v-else class="space-y-2.5">
          <article
            v-for="rep in replies"
            :key="rep.id"
            class="p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors flex gap-3 items-start"
          >
            <!-- Reply Avatar -->
            <Jazzicon :address="rep.authorAddress" :size="34" class="shrink-0 rounded-full mt-0.5" />

            <!-- Reply Content & Actions -->
            <div class="flex-1 min-w-0 space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <span
                  class="font-bold text-foreground text-xs hover:underline cursor-pointer"
                  @click="router.push(`/${getUserIdentity(rep.authorAddress).name}`)"
                >
                  {{ getUserIdentity(rep.authorAddress).displayName }}
                </span>
                <span>@{{ getUserIdentity(rep.authorAddress).name }}</span>
                <span>&middot;</span>
                <span class="hover:underline">{{ formatRelativeTime(rep.createdAt) }}</span>
              </div>

              <p class="text-xs sm:text-sm leading-relaxed text-foreground font-sans whitespace-pre-wrap break-words">
                <CashtagText :text="rep.content" :tokens="allTokens" />
              </p>

              <!-- Reply Action Row -->
              <div class="flex items-center gap-4 pt-1 text-xs text-muted-foreground font-mono">
                <button
                  type="button"
                  class="flex items-center gap-1 hover:text-rose-500 transition cursor-pointer select-none"
                  :class="rep.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
                  @click="handleLikeReply(rep.id)"
                >
                  <Heart
                    class="w-3.5 h-3.5"
                    :class="rep.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
                  />
                  <span>{{ rep.likesCount }}</span>
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ShareModal
      :is-open="isShareModalOpen"
      :call="post"
      @close="isShareModalOpen = false"
    />

    <QuoteModal
      :is-open="isQuoteModalOpen"
      :target-call="post"
      :account="account"
      @close="isQuoteModalOpen = false"
      @quote-posted="loadPost"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Repeat,
  Quote,
  Share2,
  Loader2,
  AlertCircle,
  BarChart2,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge, TraderTagBadge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Jazzicon } from '@/components/ui/avatar';
import { CashtagText, ShareModal, QuoteModal } from '@/components/feed';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { useFeed, isWhaleCaller } from '@/composables/useFeed';
import { shortenAddress, formatRelativeTime, formatCompactUsd } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { toast } from '@/components/ui/sonner';
import type { FeedCalloutItem } from '@proto/shared-types';

const route = useRoute();
const router = useRouter();
const { account, openWallet } = useWallet();
const { tokens: allTokens, fetchTokens } = useTokenStore();
const { toggleLike, toggleRepost, recordView } = useFeed();

const calloutId = computed(() => String(route.params.id || route.params.detail || ''));
const post = ref<FeedCalloutItem | null>(null);
const replies = ref<FeedCalloutItem[]>([]);
const loading = ref(true);

const replyContent = ref('');
const isSubmittingReply = ref(false);
const replyTextarea = ref<HTMLTextAreaElement | null>(null);

const isShareModalOpen = ref(false);
const isQuoteModalOpen = ref(false);

function goBack(): void {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/feed');
  }
}

function focusReplyInput(): void {
  replyTextarea.value?.focus();
}

function formatViews(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val || 0);
}

function formatAbsoluteTime(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

async function loadPost(): Promise<void> {
  const targetId = calloutId.value;
  if (!targetId) return;
  loading.value = true;
  try {
    const viewerParam = account.value ? `?viewer=${account.value}` : '';
    const res = await fetch(`/api/callouts/${targetId}${viewerParam}`);
    const data = await res.json();
    if (data.success && data.data) {
      post.value = data.data;
      replies.value = data.data.replies || [];
      recordView(targetId);
    } else {
      post.value = null;
    }
  } catch {
    post.value = null;
  } finally {
    loading.value = false;
  }
}

async function handleLikePost(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  if (!post.value) return;
  const res = await toggleLike(post.value.id, account.value);
  if (res) {
    post.value.likesCount = res.likesCount;
    post.value.isLikedByViewer = res.liked;
  }
}

async function handleRepostPost(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  if (!post.value) return;
  const res = await toggleRepost(post.value.id, account.value);
  if (res) {
    post.value.repostsCount = res.repostsCount;
    post.value.isRepostedByViewer = res.reposted;
    toast.success(res.reposted ? 'Reposted!' : 'Removed repost');
  }
}

async function handleLikeReply(replyId: string): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  const res = await toggleLike(replyId, account.value);
  if (res) {
    const rep = replies.value.find((r) => r.id === replyId);
    if (rep) {
      rep.likesCount = res.likesCount;
      rep.isLikedByViewer = res.liked;
    }
  }
}

async function submitReply(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  if (!post.value || !replyContent.value.trim()) return;

  isSubmittingReply.value = true;
  try {
    const res = await fetch(`/api/tokens/${post.value.tokenAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: account.value,
        content: replyContent.value.trim(),
        parentId: post.value.id,
        callType: 'comment',
      }),
    });
    const data = await res.json();
    if (data.success && data.data) {
      toast.success('Reply posted!');
      replyContent.value = '';
      replies.value.push(data.data);
    } else {
      toast.error(data.message || 'Failed to post reply');
    }
  } catch {
    toast.error('Failed to post reply');
  } finally {
    isSubmittingReply.value = false;
  }
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

onMounted(async () => {
  await Promise.allSettled([loadPost(), fetchTokens()]);
});
</script>
