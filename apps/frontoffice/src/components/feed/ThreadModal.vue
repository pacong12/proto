<template>
  <div
    v-if="isOpen && targetCall"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[90vh]"
    >
      <!-- Thread Modal Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
        <div class="flex items-center gap-2">
          <MessageCircle class="w-4 h-4 text-primary" />
          <h2 class="text-sm font-bold text-foreground">Thread & Discussion</h2>
        </div>
        <button
          type="button"
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Scrollable Conversation Body -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- Root Post -->
        <article class="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
          <!-- Author Header -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <Jazzicon :address="targetCall.authorAddress" :size="30" class="shrink-0 rounded-full" />
              <div class="min-w-0 leading-tight">
                <span class="font-bold text-foreground text-xs hover:underline cursor-pointer">
                  {{ shortenAddress(targetCall.authorAddress, 6, 4) }}
                </span>
                <span class="text-[10px] text-muted-foreground block">Caller</span>
              </div>
            </div>
            <span class="text-[10px] text-muted-foreground shrink-0">
              {{ formatRelativeTime(targetCall.createdAt) }}
            </span>
          </div>

          <!-- Root Content with Cashtags -->
          <p class="text-xs sm:text-sm leading-relaxed text-foreground font-sans font-medium whitespace-pre-wrap break-words">
            <CashtagText :text="targetCall.content" :tokens="tokens" />
          </p>

          <!-- Quoted Callout (if root is quoting someone) -->
          <div
            v-if="targetCall.quotedCallout"
            class="p-3 rounded-xl border border-border/80 bg-card/60 space-y-2 text-xs"
          >
            <div class="flex items-center justify-between text-[11px]">
              <div class="flex items-center gap-1.5">
                <Jazzicon :address="targetCall.quotedCallout.authorAddress" :size="16" />
                <span class="font-bold text-foreground">
                  {{ shortenAddress(targetCall.quotedCallout.authorAddress, 6, 4) }}
                </span>
                <span v-if="targetCall.quotedCallout.tokenSymbol" class="text-primary font-bold">
                  ${{ targetCall.quotedCallout.tokenSymbol }}
                </span>
              </div>
              <span class="text-[10px] text-muted-foreground">
                {{ formatRelativeTime(targetCall.quotedCallout.createdAt) }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground font-sans">
              {{ targetCall.quotedCallout.content }}
            </p>
          </div>

          <!-- Attached Image (if any) -->
          <div
            v-if="targetCall.imageUrl"
            class="rounded-xl overflow-hidden border border-border bg-muted/20 max-h-60 cursor-pointer"
            @click="openImage(targetCall.imageUrl)"
          >
            <img :src="resolveSafeUrl(targetCall.imageUrl)" alt="Attachment" class="w-full h-full object-cover" />
          </div>

          <!-- Mini Coin Widget Card -->
          <div
            class="p-2.5 rounded-xl border border-border bg-card flex items-center justify-between gap-3 text-xs"
          >
            <div class="flex items-center gap-2 min-w-0">
              <OptimizedImage
                :src="targetCall.tokenLogo"
                :alt="targetCall.tokenName || 'Token'"
                :fallback-text="targetCall.tokenSymbol || 'TOK'"
                :width="28"
                :height="28"
                class="rounded-full border border-border shrink-0"
              />
              <div class="min-w-0">
                <span class="font-black text-foreground block text-xs">
                  ${{ targetCall.tokenSymbol || 'TOKEN' }}
                </span>
                <span v-if="targetCall.targetMcap" class="text-[10px] text-emerald-500 font-bold">
                  Target: {{ targetCall.targetMcap }}
                </span>
              </div>
            </div>

            <div class="text-right shrink-0">
              <span class="text-[9px] text-muted-foreground block uppercase font-bold">Position</span>
              <span class="text-xs font-bold text-foreground">
                {{ targetCall.positionUsd ? `$${targetCall.positionUsd.toFixed(1)}` : 'Holding' }}
              </span>
            </div>
          </div>

          <!-- Action bar -->
          <div class="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <button
              type="button"
              class="flex items-center gap-1.5 hover:text-rose-500 transition cursor-pointer"
              :class="targetCall.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
              @click="emit('toggle-like', targetCall.id)"
            >
              <Heart
                class="w-3.5 h-3.5"
                :class="targetCall.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
              />
              <span>{{ targetCall.likesCount }}</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 hover:text-emerald-500 transition cursor-pointer"
              :class="targetCall.isRepostedByViewer ? 'text-emerald-500 font-bold' : ''"
              @click="emit('toggle-repost', targetCall.id)"
            >
              <Repeat class="w-3.5 h-3.5" />
              <span>{{ targetCall.repostsCount || 0 }}</span>
            </button>

            <!-- Total Views (Display only, strictly NOT clickable) -->
            <div
              class="flex items-center gap-1 text-muted-foreground select-none cursor-default"
              title="Views"
            >
              <BarChart2 class="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>{{ formatViews(targetCall.viewsCount || 0) }} Views</span>
            </div>

            <button
              type="button"
              class="flex items-center gap-1 hover:text-foreground transition cursor-pointer"
              @click="emit('share', targetCall)"
            >
              <Share2 class="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </article>

        <!-- Divider with Replies count -->
        <div class="flex items-center gap-2 text-muted-foreground text-[11px] font-bold px-1">
          <span>Replies ({{ replies.length }})</span>
          <div class="flex-1 h-px bg-border" />
        </div>

        <!-- Replies List -->
        <div v-if="loadingThread" class="py-8 text-center text-muted-foreground">
          <Loader2 class="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
          <span>Loading discussion...</span>
        </div>

        <Empty
          v-else-if="replies.length === 0"
          title="No replies yet"
          description="Start the conversation!"
          class="py-8 border-none bg-muted/20"
        >
          <template #icon>
            <MessageCircle class="w-5 h-5 text-muted-foreground opacity-60" />
          </template>
        </Empty>

        <div v-else class="space-y-3">
          <div
            v-for="rep in replies"
            :key="rep.id"
            class="p-3.5 rounded-xl border border-border bg-card space-y-2 hover:border-foreground/20 transition"
          >
            <div class="flex items-center justify-between text-[11px]">
              <div class="flex items-center gap-2">
                <Jazzicon :address="rep.authorAddress" :size="20" class="rounded-full" />
                <span class="font-bold text-foreground">
                  {{ shortenAddress(rep.authorAddress, 6, 4) }}
                </span>
              </div>
              <span class="text-[10px] text-muted-foreground">
                {{ formatRelativeTime(rep.createdAt) }}
              </span>
            </div>

            <p class="text-xs text-foreground font-sans font-medium whitespace-pre-wrap break-words">
              <CashtagText :text="rep.content" :tokens="tokens" />
            </p>

            <div class="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
              <button
                type="button"
                class="flex items-center gap-1.5 hover:text-rose-500 transition cursor-pointer"
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
        </div>
      </div>

      <!-- Thread Reply Composer Footer -->
      <div class="p-3.5 sm:p-4 border-t border-border bg-card space-y-2">
        <div class="flex items-start gap-2.5">
          <Jazzicon
            :address="account || '0x0000000000000000000000000000000000000000'"
            :size="28"
            class="shrink-0 rounded-full mt-1"
          />
          <div class="flex-1 min-w-0 space-y-2">
            <textarea
              v-model="replyText"
              rows="2"
              maxlength="500"
              placeholder="Post your reply... (use $TICKER to reference tokens)"
              class="w-full text-xs font-sans p-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
            />
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-muted-foreground font-mono">
                {{ replyText.length }}/500
              </span>
              <Button
                size="sm"
                class="h-7 px-3 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                :disabled="isSubmittingReply || !replyText.trim()"
                @click="submitReply"
              >
                <Loader2 v-if="isSubmittingReply" class="w-3 h-3 animate-spin" />
                <Send v-else class="w-3 h-3" />
                <span>Reply</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  MessageCircle,
  X,
  Heart,
  Repeat,
  Share2,
  BarChart2,
  Send,
  Loader2,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Jazzicon } from '@/components/ui/avatar';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import CashtagText from './CashtagText.vue';
import { shortenAddress, formatRelativeTime } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { FeedCalloutItem, LaunchedTokenEntity } from '@proto/shared-types';

const props = defineProps<{
  isOpen: boolean;
  targetCall: FeedCalloutItem | null;
  account?: string | null;
  tokens?: ReadonlyArray<{ token: LaunchedTokenEntity }>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle-like', calloutId: string): void;
  (e: 'toggle-repost', calloutId: string): void;
  (e: 'share', call: FeedCalloutItem): void;
  (e: 'reply-posted', newReply: FeedCalloutItem): void;
}>();

const replies = ref<FeedCalloutItem[]>([]);
const loadingThread = ref(false);
const replyText = ref('');
const isSubmittingReply = ref(false);

function formatViews(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val || 0);
}

watch(
  () => props.targetCall,
  async (call) => {
    if (call && props.isOpen) {
      await loadThreadData(call.id);
    }
  },
  { immediate: true },
);

async function loadThreadData(calloutId: string): Promise<void> {
  loadingThread.value = true;
  try {
    const viewerParam = props.account ? `?viewer=${props.account}` : '';
    const res = await fetch(`/api/callouts/${calloutId}${viewerParam}`);
    const data = await res.json();
    if (data.success && data.data) {
      replies.value = data.data.replies || [];
    } else {
      replies.value = [];
    }
  } catch {
    replies.value = [];
  } finally {
    loadingThread.value = false;
  }
}

async function submitReply(): Promise<void> {
  if (!props.account) {
    toast.error('Please connect wallet to reply');
    return;
  }
  if (!props.targetCall || !replyText.value.trim()) return;

  isSubmittingReply.value = true;
  try {
    const res = await fetch(`/api/tokens/${props.targetCall.tokenAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: props.account,
        content: replyText.value.trim(),
        parentId: props.targetCall.id,
        callType: 'comment',
      }),
    });
    const data = await res.json();
    if (data.success && data.data) {
      toast.success('Reply posted!');
      replyText.value = '';
      replies.value.push(data.data);
      emit('reply-posted', data.data);
    } else {
      toast.error(data.message || 'Failed to post reply');
    }
  } catch {
    toast.error('Failed to post reply');
  } finally {
    isSubmittingReply.value = false;
  }
}

async function handleLikeReply(replyId: string): Promise<void> {
  if (!props.account) {
    toast.error('Connect wallet to like');
    return;
  }
  try {
    const res = await fetch(`/api/comments/${replyId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: props.account }),
    });
    const data = await res.json();
    if (data.success && data.data) {
      const rep = replies.value.find((r) => r.id === replyId);
      if (rep) {
        rep.likesCount = data.data.likesCount;
        rep.isLikedByViewer = data.data.liked;
      }
    }
  } catch {}
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
