<template>
  <div class="max-w-6xl mx-auto space-y-4 font-sans">
    <!-- Main Two-Column Hybrid Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <!-- ============================================================
           LEFT: Social Alpha Stream (Hybrid Timeline)
           ============================================================ -->
      <div class="space-y-4 min-w-0">
        <FeedFilterBar
          v-model:filter="activeFilter"
          v-model:chain="selectedChainFilter"
          :tabs="filterTabs"
          :chains="chainFilterOptions"
        />

        <FeedComposer @posted="onCalloutPosted" @navigate-to-token="navigateToToken" />

        <!-- 3. Hybrid Timeline Cards (Card-based with X / Twitter conversation mechanics) -->
        <div
          v-if="loading && callouts.length === 0"
          class="py-20 text-center text-muted-foreground"
        >
          <Loader2 class="w-7 h-7 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p class="text-xs">Loading community alpha...</p>
        </div>

        <Empty
          v-else-if="networkCallouts.length === 0"
          :title="`No callouts on ${activeNetwork.name}`"
          :description="`Be the first to post alpha on ${activeNetwork.name} using the box above!`"
          class="py-14"
        >
          <template #icon>
            <Megaphone class="w-6 h-6 text-muted-foreground" />
          </template>
        </Empty>

        <div v-else class="space-y-3.5">
          <!-- The Hybrid Post Card Component -->
          <FeedCalloutCard
            v-for="call in paginatedCallouts"
            :key="call.id"
            :call="call"
            :all-tokens="allTokens"
            :is-pinned="isPinned"
            @navigate-to-caller="navigateToCaller"
            @navigate-to-token="navigateToToken"
            @open-thread="openThreadModal"
            @open-quote="openQuoteModal"
            @open-share="openShareModal"
            @toggle-like="handleLike"
            @toggle-repost="handleRepost"
            @toggle-pin="togglePin"
            @open-image="openImage"
          />
        </div>

        <!-- Pagination -->
        <div v-if="networkCallouts.length > pageSize" class="flex justify-center p-3">
          <Pagination
            :total="networkCallouts.length"
            :items-per-page="pageSize"
            :page="currentPage"
            @update:page="currentPage = $event"
          />
        </div>
      </div>

      <!-- RIGHT: Hybrid Alpha Radar & Trending Movers Component -->
      <div class="space-y-4 lg:sticky lg:top-20">
        <FeedSidebar
          v-model:search-query="searchQuery"
          :hot-tokens="hotTokens"
          @select-token="navigateToToken"
        />
        <FeedTopCallers :callers="topCallers" @select-caller="navigateToCaller" />
      </div>
    </div>

    <!-- Modals & Sheets -->
    <ShareModal
      :is-open="isShareModalOpen"
      :call="activeShareCall"
      @close="isShareModalOpen = false"
    />

    <ThreadModal
      :is-open="isThreadModalOpen"
      :target-call="activeThreadCall"
      :account="account"
      :tokens="allTokens"
      @close="isThreadModalOpen = false"
      @toggle-like="handleLike"
      @toggle-repost="handleRepost"
      @share="openShareModal"
      @reply-posted="onReplyPosted"
    />

    <QuoteModal
      :is-open="isQuoteModalOpen"
      :target-call="activeQuoteCall"
      :account="account"
      @close="isQuoteModalOpen = false"
      @quote-posted="onQuotePosted"
    />
  </div>
</template>

<script setup lang="ts">
import { resolveSafeUrl } from '@/lib/safe-url';
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { usePinnedTokens } from '@/composables/usePinnedTokens';
import { useFeed, type FeedFilterType } from '@/composables/useFeed';
import { useFollows } from '@/composables/useFollows';
import { Loader2, Megaphone } from 'lucide-vue-next';
import { Empty } from '@/components/ui/empty';
import { Pagination } from '@/components/ui/pagination';
import ShareModal from './ShareModal.vue';
import ThreadModal from './ThreadModal.vue';
import QuoteModal from './QuoteModal.vue';
import FeedSidebar from './FeedSidebar.vue';
import FeedCalloutCard from './FeedCalloutCard.vue';
import FeedComposer from './FeedComposer.vue';
import FeedFilterBar from './FeedFilterBar.vue';
import FeedTopCallers from './FeedTopCallers.vue';
import { rankCallers } from '@/lib/top-callers';
import { getChainIcon, getChainShortName } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { SUPPORTED_CHAINS } from '@goton/shared-types';
import { getUserIdentity } from '@/lib/username';
import { toast } from '@/components/ui/sonner';
import type { FeedCalloutItem } from '@goton/shared-types';

const emit = defineEmits<{
  (e: 'select-token', address: string): void;
}>();

const router = useRouter();
const { t } = useI18n();
const { account, openWallet, activeNetwork } = useWallet();
const { tokens: allTokens, networkTokens, getTokenNetwork, fetchTokens } = useTokenStore();
const {
  callouts,
  followedAuthors,
  loading,
  activeFilter,
  searchQuery,
  currentPage,
  pageSize,
  filteredCallouts,
  fetchFeed,
  toggleLike,
  toggleRepost,
} = useFeed();

type ChainFilterType = string;
const selectedChainFilter = ref<ChainFilterType>('all');

const chainFilterOptions = computed(() => {
  const supported = Object.values(SUPPORTED_CHAINS);
  return [
    {
      key: 'all',
      label: 'All Chains',
      icons: supported.map((net) => getChainIcon(net)),
    },
    ...supported.map((net) => ({
      key: String(net.chainId),
      label: getChainShortName(net),
      icons: [getChainIcon(net)],
    })),
  ];
});

// Another tab, chain or network starts the list from its first page.
watch([activeFilter, selectedChainFilter, activeNetwork], () => {
  currentPage.value = 1;
});

// Multi-chain smart feed stream (shows all chains by default with instant filter)
const networkCallouts = computed(() => {
  const base = filteredCallouts.value;
  if (selectedChainFilter.value === 'all') {
    return base;
  }
  const targetChainId = Number(selectedChainFilter.value);
  return base.filter((c) => getTokenNetwork(c.tokenAddress).chainId === targetChainId);
});

const paginatedCallouts = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return networkCallouts.value.slice(start, start + pageSize);
});

// Watchlist Pin Feature — shared singleton composable (FE-02)
const { togglePin, isPinned } = usePinnedTokens();

// Social Modals state
const isShareModalOpen = ref(false);
const activeShareCall = ref<FeedCalloutItem | null>(null);

const isThreadModalOpen = ref(false);
const activeThreadCall = ref<FeedCalloutItem | null>(null);

const isQuoteModalOpen = ref(false);
const activeQuoteCall = ref<FeedCalloutItem | null>(null);

function openShareModal(call: FeedCalloutItem): void {
  activeShareCall.value = call;
  isShareModalOpen.value = true;
}

function openThreadModal(call: FeedCalloutItem): void {
  activeThreadCall.value = call;
  isThreadModalOpen.value = true;
}

function openQuoteModal(call: FeedCalloutItem): void {
  activeQuoteCall.value = call;
  isQuoteModalOpen.value = true;
}

async function handleRepost(commentId: string): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  const result = await toggleRepost(commentId, account.value);
  if (result) {
    toast.success(result.reposted ? 'Reposted!' : 'Removed repost');
  }
}

function onReplyPosted(reply: FeedCalloutItem): void {
  if (activeThreadCall.value) {
    activeThreadCall.value.repliesCount = (activeThreadCall.value.repliesCount || 0) + 1;
  }
  const rootItem = callouts.value.find((c) => c.id === reply.parentId);
  if (rootItem) {
    rootItem.repliesCount = (rootItem.repliesCount || 0) + 1;
  }
}

async function onQuotePosted(): Promise<void> {
  await fetchFeed(account.value || undefined);
}

async function onCalloutPosted(): Promise<void> {
  await fetchFeed(account.value || undefined);
}

const filterTabs = computed<Array<{ key: FeedFilterType; label: string }>>(() => [
  { key: 'all', label: 'All Calls' },
  ...(account.value ? [{ key: 'following' as const, label: t('followingTab') }] : []),
  { key: 'whale', label: 'Whales' },
  { key: 'profit', label: 'In Profit' },
  { key: 'media', label: 'Media' },
]);

// Following tab: the authors the connected wallet follows.
const { list: listFollows } = useFollows();
watch(
  () => account.value,
  async (viewer) => {
    if (!viewer) {
      followedAuthors.value = new Set();
      if (activeFilter.value === 'following') activeFilter.value = 'all';
      return;
    }
    const rows = await listFollows(viewer, 'following');
    followedAuthors.value = new Set(rows.map((r) => r.address.toLowerCase()));
  },
  { immediate: true },
);

// Sidebar: the tokens moving most in the last 24h (volume first, then price change).
const hotTokens = computed(() => {
  if (!networkTokens.value) return [];
  return [...networkTokens.value]
    .sort(
      (a, b) =>
        (b.marketData?.volume24hUsd ?? 0) - (a.marketData?.volume24hUsd ?? 0) ||
        Math.abs(b.marketData?.priceChange24h ?? 0) - Math.abs(a.marketData?.priceChange24h ?? 0),
    )
    .slice(0, 5);
});

// Leaderboard of the loaded calls, ranked by profit since each call.
const topCallers = computed(() => rankCallers(callouts.value));

async function handleLike(commentId: string): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  await toggleLike(commentId, account.value);
}

function navigateToToken(address: string): void {
  if (address) {
    emit('select-token', address);
    router.push(`/launchpad/${address}`);
  }
}

function navigateToCaller(address: string): void {
  if (address) {
    router.push(`/${getUserIdentity(address).name}`);
  }
}

function openImage(url?: string): void {
  if (url && typeof window !== 'undefined') {
    window.open(resolveSafeUrl(url), '_blank', 'noopener,noreferrer');
  }
}

onMounted(async () => {
  await Promise.allSettled([fetchFeed(account.value || undefined), fetchTokens()]);
});
</script>
