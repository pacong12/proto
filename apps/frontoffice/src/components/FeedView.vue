<template>
  <div class="space-y-6">
    <!-- Header Row -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <Megaphone class="w-6 h-6 text-primary shrink-0" />
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
            {{ t('feed') }}
          </h1>
        </div>
        <p class="text-xs sm:text-sm mt-1 text-muted-foreground font-mono">
          Live alpha, market cap targets, and community calls on Robinhood & Arc Chain.
        </p>
      </div>

      <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
        <!-- Search Filter -->
        <div class="relative w-full sm:w-48">
          <Search
            class="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
          />
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search $ticker, alpha..."
            class="h-8 pl-8 pr-2.5 text-xs font-mono bg-card"
          />
        </div>

        <!-- Refresh Button -->
        <Button
          variant="outline"
          size="sm"
          class="h-8 w-8 p-0 border-border hover:bg-muted text-foreground cursor-pointer shrink-0"
          title="Refresh feed"
          aria-label="Refresh feed"
          @click="fetchFeed"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </Button>
      </div>
    </div>

    <!-- Filter Pills Row -->
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs font-mono">
      <button
        v-for="flt in [
          { key: 'all', label: `All Calls (${callouts.length})` },
          { key: 'target', label: 'With Price Targets' },
          { key: 'media', label: 'With Images' },
        ]"
        :key="flt.key"
        type="button"
        class="px-3 py-1.5 rounded-xl border transition cursor-pointer font-bold select-none whitespace-nowrap"
        :class="
          activeFilter === flt.key
            ? 'bg-foreground text-background border-foreground shadow-2xs'
            : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
        "
        @click="activeFilter = flt.key as any"
      >
        {{ flt.label }}
      </button>
    </div>

    <!-- Feed Content -->
    <div v-if="loading && callouts.length === 0" class="py-20 text-center text-muted-foreground">
      <Loader2 class="w-6 h-6 animate-spin mx-auto mb-3 text-primary" />
      <p class="text-xs font-mono font-medium">Loading live community calls...</p>
    </div>

    <div
      v-else-if="filteredCallouts.length === 0"
      class="py-16 text-center text-muted-foreground rounded-2xl border border-border bg-card p-8 space-y-3 font-mono"
    >
      <Megaphone class="w-10 h-10 mx-auto text-muted-foreground/60" />
      <h3 class="text-sm font-bold text-foreground">No callouts match your filter</h3>
      <p class="text-xs text-muted-foreground max-w-sm mx-auto">
        Go to any token page and click the "Call $TOKEN" button to post the first callout to the
        community!
      </p>
      <Button
        variant="default"
        size="sm"
        class="h-8 text-xs font-bold gap-1.5 rounded-xl cursor-pointer"
        @click="router.push('/launchpad')"
      >
        <ArrowRight class="w-3.5 h-3.5" />
        <span>Explore Tokens to Call</span>
      </Button>
    </div>

    <!-- Callouts Cards Grid / Stream (pump.fun style) -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="call in paginatedCallouts"
        :key="call.id"
        class="rounded-2xl border border-border bg-card hover:border-foreground/30 transition-all p-4 space-y-3 flex flex-col justify-between shadow-2xs font-mono text-xs"
      >
        <!-- Top: Author + Time + Badges -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <Jazzicon :address="call.authorAddress" :size="20" />
              <span class="font-bold text-foreground truncate">
                {{ shortenAddress(call.authorAddress, 6, 4) }}
              </span>
              <Badge
                v-if="call.callType === 'call'"
                variant="secondary"
                class="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20 font-bold"
              >
                CALL
              </Badge>
            </div>
            <span class="text-[10px] text-muted-foreground shrink-0">
              {{ formatRelativeTime(call.createdAt) }}
            </span>
          </div>

          <!-- Thesis / Content Text -->
          <p
            class="text-xs leading-relaxed text-foreground font-sans font-medium whitespace-pre-wrap break-words"
          >
            {{ call.content }}
          </p>

          <!-- Attached Image (if any) -->
          <div
            v-if="call.imageUrl"
            class="rounded-xl overflow-hidden border border-border bg-muted/30 max-h-48"
          >
            <img :src="call.imageUrl" alt="Attachment" class="w-full h-full object-cover" />
          </div>
        </div>

        <!-- Embedded Token Mini Card (pump.fun callout signature) -->
        <div class="space-y-3 pt-1">
          <div
            class="p-3 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 transition cursor-pointer flex items-center justify-between gap-3"
            title="Click to view & trade token"
            @click="navigateToToken(call.tokenAddress)"
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
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 leading-none">
                  <span class="font-extrabold text-foreground text-xs">
                    ${{ call.tokenSymbol || 'TOKEN' }}
                  </span>
                  <span class="text-[10px] text-muted-foreground truncate">
                    {{ call.tokenName }}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                  <span>
                    MC:
                    <strong class="text-foreground">
                      ${{ formatCompactUsd(call.tokenMarketCapUsd ?? 4200) }}
                    </strong>
                  </span>
                  <span v-if="call.targetMcap" class="text-emerald-500 font-bold truncate">
                    🎯 {{ call.targetMcap }}
                  </span>
                </div>
              </div>
            </div>

            <div class="text-right shrink-0">
              <span class="text-[9px] text-muted-foreground block uppercase font-bold"
                >Caller Position</span
              >
              <span class="text-xs font-bold text-foreground">
                {{ call.positionUsd ? `$${call.positionUsd.toFixed(2)}` : 'Verified' }}
              </span>
            </div>
          </div>

          <!-- Bottom Actions: Like Reaction & Share Call on X -->
          <div class="flex items-center justify-between pt-1 border-t border-border text-[11px]">
            <button
              type="button"
              class="flex items-center gap-1.5 text-muted-foreground hover:text-rose-500 transition cursor-pointer"
              :class="call.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
              @click="toggleLike(call.id)"
            >
              <Heart
                class="w-3.5 h-3.5"
                :class="call.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
              />
              <span>{{ call.likesCount }}</span>
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition cursor-pointer font-bold text-[10px]"
                title="Share this call on X"
                @click="shareCallOnX(call)"
              >
                <Share2 class="w-3 h-3" />
                <span>Share</span>
              </button>

              <Button
                size="sm"
                variant="outline"
                class="h-6 px-2 text-[10px] font-bold rounded-lg cursor-pointer border-border"
                @click="navigateToToken(call.tokenAddress)"
              >
                Trade
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="filteredCallouts.length > pageSize" class="flex justify-center pt-4">
      <Pagination
        :total="filteredCallouts.length"
        :items-per-page="pageSize"
        :page="currentPage"
        @update:page="currentPage = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '../composables/useWallet';
import { Megaphone, Search, RefreshCw, Loader2, Heart, Share2, ArrowRight } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Jazzicon } from '@/components/ui/avatar';
import { shortenAddress, formatRelativeTime, formatCompactUsd } from '@/lib/utils';
import type { FeedCalloutItem } from '@proto/shared-types';

const emit = defineEmits<{
  (e: 'select-token', address: string): void;
}>();

const { t } = useI18n();
const router = useRouter();
const { account, openWallet } = useWallet();

const callouts = ref<FeedCalloutItem[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const activeFilter = ref<'all' | 'target' | 'media'>('all');
const currentPage = ref(1);
const pageSize = 12;

async function fetchFeed() {
  loading.value = true;
  try {
    const viewerParam = account.value ? `?viewer=${account.value}` : '';
    const res = await fetch(`/api/feed${viewerParam}`);
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      callouts.value = envelope.data;
    } else {
      callouts.value = [];
    }
  } catch {
    callouts.value = [];
  } finally {
    loading.value = false;
  }
}

const filteredCallouts = computed(() => {
  let list = callouts.value;

  if (activeFilter.value === 'target') {
    list = list.filter((c) => Boolean(c.targetMcap));
  } else if (activeFilter.value === 'media') {
    list = list.filter((c) => Boolean(c.imageUrl));
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.content.toLowerCase().includes(q) ||
        (c.tokenSymbol && c.tokenSymbol.toLowerCase().includes(q)) ||
        (c.tokenName && c.tokenName.toLowerCase().includes(q)) ||
        c.authorAddress.toLowerCase().includes(q),
    );
  }

  return list;
});

const paginatedCallouts = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredCallouts.value.slice(start, start + pageSize);
});

async function toggleLike(commentId: string) {
  if (!account.value) {
    openWallet();
    return;
  }
  try {
    const res = await fetch(`/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: account.value }),
    });
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      const idx = callouts.value.findIndex((c) => c.id === commentId);
      if (idx !== -1) {
        callouts.value[idx].likesCount = envelope.data.likesCount;
        callouts.value[idx].isLikedByViewer = envelope.data.liked;
      }
    }
  } catch {
    // Non-blocking
  }
}

function navigateToToken(address: string) {
  if (address) {
    emit('select-token', address);
    router.push(`/launchpad/${address}`);
  }
}

function shareCallOnX(call: FeedCalloutItem) {
  if (typeof window !== 'undefined') {
    const symbolStr = call.tokenSymbol ? `$${call.tokenSymbol} ` : '';
    const targetStr = call.targetMcap ? `(Target: ${call.targetMcap}) ` : '';
    const tokenUrl = `${window.location.origin}/launchpad/${call.tokenAddress}`;
    const text = encodeURIComponent(
      `Check out this call on ${symbolStr}${targetStr}on @proto_protocol! 📢\n\n"${call.content.slice(0, 120)}"\n\n${tokenUrl}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}

onMounted(() => {
  fetchFeed();
});
</script>
