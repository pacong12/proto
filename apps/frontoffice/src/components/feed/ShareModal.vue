<template>
  <div
    v-if="isOpen && call"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[90vh]"
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-border">
        <div class="flex items-center gap-2">
          <Share2 class="w-4 h-4 text-primary" />
          <h2 class="text-sm font-bold text-foreground">Share Callout</h2>
        </div>
        <button
          type="button"
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="p-5 space-y-4 overflow-y-auto">
        <!-- Call Preview Card -->
        <div class="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Jazzicon :address="call.authorAddress" :size="20" />
              <span class="font-bold text-foreground">
                {{ shortenAddress(call.authorAddress, 6, 4) }}
              </span>
              <Badge
                variant="secondary"
                class="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/20"
              >
                ${{ call.tokenSymbol || 'TOKEN' }}
              </Badge>
            </div>
            <span class="text-[10px] text-muted-foreground">
              {{ formatRelativeTime(call.createdAt) }}
            </span>
          </div>
          <p class="text-xs text-foreground font-sans line-clamp-2">
            {{ call.content }}
          </p>
        </div>

        <!-- Share Options Grid / List -->
        <div class="space-y-2">
          <!-- 1. Copy Link -->
          <button
            type="button"
            class="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/50 transition cursor-pointer text-left"
            @click="copyPostLink"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Check v-if="copiedLink" class="w-4 h-4 text-primary" />
                <Link2 v-else class="w-4 h-4" />
              </div>
              <div>
                <span class="font-bold text-foreground block">
                  {{ copiedLink ? 'Link Copied!' : 'Copy Link' }}
                </span>
                <span class="text-[10px] text-muted-foreground">
                  Direct permalink to this callout
                </span>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-muted-foreground" />
          </button>

          <!-- 2. Share on X (Twitter) -->
          <button
            type="button"
            class="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/50 transition cursor-pointer text-left"
            @click="shareOnX"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path
                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  />
                </svg>
              </div>
              <div>
                <span class="font-bold text-foreground block">Share on X (Twitter)</span>
                <span class="text-[10px] text-muted-foreground">
                  Post with cashtags, targets, and chart link
                </span>
              </div>
            </div>
            <ExternalLink class="w-4 h-4 text-muted-foreground" />
          </button>

          <!-- 3. Toggle PnL Alpha Card Preview -->
          <button
            type="button"
            class="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/50 transition cursor-pointer text-left"
            :class="showPnlCard ? 'border-primary/50 bg-primary/5' : ''"
            @click="showPnlCard = !showPnlCard"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <TrendingUp class="w-4 h-4" />
              </div>
              <div>
                <span class="font-bold text-foreground block">PnL Alpha Card</span>
                <span class="text-[10px] text-muted-foreground">
                  Visual badge card with caller position & targets
                </span>
              </div>
            </div>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="{ 'rotate-180': showPnlCard }"
            />
          </button>
        </div>

        <!-- Visual PnL Alpha Card Preview Area -->
        <div v-if="showPnlCard" class="space-y-3 pt-2">
          <div
            id="pnl-alpha-card"
            class="p-4 rounded-2xl bg-card border-2 border-primary/40 text-card-foreground shadow-xl space-y-3 relative overflow-hidden"
          >
            <!-- Background Glow Accent (#FC4198) -->
            <div class="absolute -top-12 -right-12 w-32 h-32 bg-primary/15 rounded-full blur-2xl pointer-events-none" />

            <!-- Brand Header -->
            <div class="flex items-center justify-between relative z-10 border-b border-border pb-2">
              <div class="flex items-center gap-1.5 font-bold tracking-wider text-[11px] text-primary">
                <Sparkles class="w-3.5 h-3.5" />
                <span>PROTO ALPHA SIGNAL</span>
              </div>
              <Badge variant="outline" class="text-[9px] border-primary/30 text-primary font-mono">
                Verified Position
              </Badge>
            </div>

            <!-- Token Details -->
            <div class="flex items-center justify-between relative z-10">
              <div class="flex items-center gap-2.5">
                <OptimizedImage
                  :src="call.tokenLogo"
                  :alt="call.tokenName || 'Token'"
                  :fallback-text="call.tokenSymbol || 'TOK'"
                  :width="40"
                  :height="40"
                  class="rounded-full border border-border shrink-0"
                />
                <div>
                  <h3 class="font-black text-sm text-foreground">
                    ${{ call.tokenSymbol || 'TOKEN' }}
                  </h3>
                  <p class="text-[10px] text-muted-foreground">
                    {{ call.tokenName || 'Proto Token' }}
                  </p>
                </div>
              </div>

              <div class="text-right">
                <span class="text-[9px] text-muted-foreground block uppercase font-bold">Target MC</span>
                <span class="text-xs font-black text-primary">
                  {{ call.targetMcap || 'Moon' }}
                </span>
              </div>
            </div>

            <!-- Position & Profit Stats Ribbon -->
            <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/50 border border-border relative z-10 font-mono">
              <div>
                <span class="text-[9px] text-muted-foreground block uppercase">Caller Position</span>
                <span class="text-xs font-bold text-foreground">
                  {{ call.positionUsd ? `$${call.positionUsd.toFixed(1)}` : 'Verified Holder' }}
                </span>
              </div>
              <div class="text-right">
                <span class="text-[9px] text-muted-foreground block uppercase">Current Profit</span>
                <span
                  class="text-xs font-bold"
                  :class="(call.profitUsd ?? 0) >= 0 ? 'text-primary' : 'text-rose-500'"
                >
                  {{ (call.profitUsd ?? 0) >= 0 ? '+' : '' }}${{ (call.profitUsd ?? 0).toFixed(1) }}
                </span>
              </div>
            </div>

            <!-- Card Footer -->
            <div class="flex items-center justify-between text-[10px] text-muted-foreground relative z-10 pt-1 font-mono">
              <span>by {{ shortenAddress(call.authorAddress, 6, 4) }}</span>
              <span>proto.it/launchpad</span>
            </div>
          </div>

          <!-- PnL Actions -->
          <div class="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              class="w-full text-xs font-bold gap-1.5 h-8 border-border hover:bg-muted cursor-pointer"
              @click="shareOnX"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                />
              </svg>
              <span>Tweet PnL</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Share2,
  X,
  Link2,
  Check,
  TrendingUp,
  ChevronDown,
  ExternalLink,
  Sparkles,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Jazzicon } from '@/components/ui/avatar';
import { shortenAddress, formatRelativeTime } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { FeedCalloutItem } from '@proto/shared-types';

const props = defineProps<{
  isOpen: boolean;
  call: FeedCalloutItem | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const copiedLink = ref(false);
const showPnlCard = ref(false);

function getPostUrl(): string {
  if (typeof window === 'undefined' || !props.call) return '';
  return `${window.location.origin}/post/${props.call.id}`;
}

async function copyPostLink(): Promise<void> {
  const url = getPostUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    copiedLink.value = true;
    toast.success('Link copied to clipboard!');
    setTimeout(() => {
      copiedLink.value = false;
    }, 2500);
  } catch {
    toast.error('Failed to copy link');
  }
}

function shareOnX(): void {
  if (typeof window === 'undefined' || !props.call) return;
  const call = props.call;
  const symbolStr = call.tokenSymbol ? `$${call.tokenSymbol} ` : '';
  const targetStr = call.targetMcap ? `Target: ${call.targetMcap} ` : '';
  const posStr = call.positionUsd ? `Position: $${call.positionUsd.toFixed(1)} ` : '';
  const url = getPostUrl();
  const text = encodeURIComponent(
    `Verified Call on ${symbolStr}\n${targetStr}${posStr}\n\n"${call.content.slice(0, 100)}"\n\n${url} via @proto_protocol`,
  );
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
}
</script>
