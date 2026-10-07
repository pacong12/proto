<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Top Headline Banner -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border"
    >
      <div>
        <div class="flex items-center gap-2">
          <Megaphone class="w-5 h-5 text-primary shrink-0" />
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
            {{ t('feed') }}
          </h1>
          <Badge
            variant="outline"
            class="text-[10px] font-mono uppercase tracking-wider text-primary border-primary/30"
          >
            Alpha Stream
          </Badge>
        </div>
        <p class="text-xs sm:text-sm text-muted-foreground font-mono mt-1">
          Real-time callouts, price targets, and on-chain verified caller positions.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-8 text-xs font-mono font-bold gap-1.5 border-border hover:bg-muted text-foreground cursor-pointer"
          title="Refresh feed"
          @click="fetchFeed(account || undefined)"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
          <span>Refresh</span>
        </Button>
      </div>
    </div>

    <!-- Main Two-Column Social Feed Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <!-- ============================================================
           LEFT: Social Media Timeline Stream
           ============================================================ -->
      <div class="space-y-5 min-w-0">
        <!-- 1. Social Post Composer (Twitter / pump.fun style) -->
        <div
          class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden font-mono text-xs"
        >
          <div class="p-4 sm:p-5 space-y-3.5">
            <div class="flex items-start gap-3">
              <Jazzicon
                :address="account || '0x0000000000000000000000000000000000000000'"
                :size="36"
                class="shrink-0 mt-0.5 rounded-full ring-2 ring-border"
              />
              <div class="flex-1 min-w-0 space-y-2">
                <!-- Textarea -->
                <textarea
                  v-model="composerContent"
                  rows="3"
                  maxlength="500"
                  placeholder="Call a coin or share alpha with the community... (e.g. $SPIDER looks primed for breakout!)"
                  class="w-full text-xs font-sans p-3 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-none leading-relaxed"
                />

                <!-- Embedded Coin Selector Pill Row -->
                <div class="flex flex-wrap items-center gap-2 pt-1">
                  <!-- Token Picker Trigger -->
                  <div class="relative">
                    <button
                      type="button"
                      class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer select-none"
                      :class="
                        selectedToken
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-muted/60 border-border text-muted-foreground hover:text-foreground'
                      "
                      @click="isTokenPickerOpen = !isTokenPickerOpen"
                    >
                      <Sparkles class="w-3 h-3 text-primary" />
                      <span>{{
                        selectedToken ? `$${selectedToken.symbol}` : 'Select Token to Call'
                      }}</span>
                      <ChevronDown class="w-3 h-3 opacity-60" />
                    </button>

                    <!-- Dropdown Token Picker -->
                    <div
                      v-if="isTokenPickerOpen"
                      class="absolute left-0 top-full mt-1.5 w-64 p-2 bg-card border border-border rounded-xl shadow-xl z-30 space-y-2"
                    >
                      <Input
                        v-model="tokenSearchQuery"
                        type="text"
                        placeholder="Search ticker..."
                        class="h-7 text-xs font-mono"
                      />
                      <div class="max-h-48 overflow-y-auto space-y-1 no-scrollbar">
                        <button
                          v-for="tItem in availableTokensList"
                          :key="tItem.token.address"
                          type="button"
                          class="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-muted text-left transition cursor-pointer"
                          @click="pickToken(tItem.token)"
                        >
                          <div class="flex items-center gap-2 min-w-0">
                            <OptimizedImage
                              :src="tItem.token.logo"
                              :alt="tItem.token.name"
                              :fallback-text="tItem.token.symbol"
                              :width="20"
                              :height="20"
                              class="rounded-full shrink-0"
                            />
                            <div class="min-w-0">
                              <span class="font-bold text-foreground block text-xs truncate">
                                ${{ tItem.token.symbol }}
                              </span>
                              <span class="text-[10px] text-muted-foreground truncate block">
                                {{ tItem.token.name }}
                              </span>
                            </div>
                          </div>
                          <span class="text-[10px] text-muted-foreground font-mono">
                            ${{ formatCompactUsd(tItem.marketData?.marketCapUsd || 4200) }}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Target MC Selector Pills -->
                  <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                    <button
                      v-for="target in [
                        '$25K MC',
                        '$50K MC',
                        '$100K MC',
                        '$500K MC',
                        '$1M MC',
                        'Moon',
                      ]"
                      :key="target"
                      type="button"
                      class="px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
                      :class="
                        composerTargetMcap === target
                          ? 'bg-foreground text-background shadow-2xs'
                          : 'bg-muted/80 text-muted-foreground hover:text-foreground'
                      "
                      @click="composerTargetMcap = target"
                    >
                      {{ target }}
                    </button>
                  </div>
                </div>

                <!-- Optional Image URL Input -->
                <div v-if="showMediaInput" class="pt-1.5">
                  <Input
                    v-model="composerImageUrl"
                    type="text"
                    placeholder="Image / Chart URL (https://... or ipfs://...)"
                    class="h-7 text-xs font-mono"
                  />
                </div>

                <!-- Position Requirement Alert for selected token (pump.fun rule) -->
                <div
                  v-if="account && selectedToken && callerTokenBalance <= 0 && !checkingBalance"
                  class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-between gap-2 text-[11px]"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <AlertCircle class="w-3.5 h-3.5 shrink-0" />
                    <span class="font-sans">
                      You must hold a position in ${{ selectedToken.symbol }} to post a callout.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    class="h-6 px-2 text-[10px] border-amber-500 text-amber-500 hover:bg-amber-500/10 shrink-0 font-bold cursor-pointer"
                    @click="navigateToToken(selectedToken.address)"
                  >
                    Buy ${{ selectedToken.symbol }}
                  </Button>
                </div>
              </div>
            </div>

            <!-- Composer Footer Bar -->
            <div class="flex items-center justify-between pt-2 border-t border-border px-1">
              <div class="flex items-center gap-2 text-muted-foreground">
                <button
                  type="button"
                  class="p-1.5 rounded-lg hover:text-foreground hover:bg-muted transition cursor-pointer"
                  :class="showMediaInput ? 'text-primary' : ''"
                  title="Attach chart or meme image"
                  @click="showMediaInput = !showMediaInput"
                >
                  <ImageIcon class="w-4 h-4" />
                </button>
                <span class="text-[10px] text-muted-foreground font-mono">
                  {{ composerContent.length }}/500
                </span>
              </div>

              <div class="flex items-center gap-2">
                <Button
                  size="sm"
                  class="h-8 px-4 text-xs font-bold gap-1.5 rounded-xl cursor-pointer shadow-xs"
                  :disabled="
                    isPostingCall ||
                    !composerContent.trim() ||
                    (selectedToken !== null && callerTokenBalance <= 0)
                  "
                  @click="submitCallout"
                >
                  <Loader2 v-if="isPostingCall" class="w-3.5 h-3.5 animate-spin" />
                  <Megaphone v-else class="w-3.5 h-3.5" />
                  <span>Post Call</span>
                </Button>
              </div>
            </div>

            <div
              v-if="composerError"
              class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2 mt-2"
            >
              {{ composerError }}
            </div>
          </div>
        </div>

        <!-- 2. Feed Timeline Filter Tabs & Search -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs"
        >
          <!-- Filter Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              v-for="flt in filterTabs"
              :key="flt.key"
              type="button"
              class="px-3 py-1.5 rounded-xl border transition cursor-pointer font-bold select-none whitespace-nowrap text-[11px]"
              :class="
                activeFilter === flt.key
                  ? 'bg-foreground text-background border-foreground shadow-2xs'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              "
              @click="handleFilterClick(flt.key)"
            >
              {{ flt.label }}
            </button>
          </div>

          <!-- Quick Search -->
          <div class="relative w-full sm:w-48">
            <Search
              class="w-3 h-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <Input
              v-model="searchQuery"
              type="text"
              placeholder="Search feed..."
              class="h-7 pl-7 pr-2.5 text-xs font-mono bg-card"
            />
          </div>
        </div>

        <!-- 3. Social Stream Feed (Twitter/X & pump.fun Stream) -->
        <div
          v-if="loading && callouts.length === 0"
          class="py-20 text-center text-muted-foreground"
        >
          <Loader2 class="w-6 h-6 animate-spin mx-auto mb-3 text-primary" />
          <p class="text-xs font-mono font-medium">Loading social callouts...</p>
        </div>

        <div
          v-else-if="filteredCallouts.length === 0"
          class="py-16 text-center text-muted-foreground rounded-2xl border border-border bg-card p-8 space-y-3 font-mono"
        >
          <Megaphone class="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 class="text-sm font-bold text-foreground">No callouts found</h3>
          <p class="text-xs text-muted-foreground max-w-sm mx-auto">
            Be the first to post alpha on Robinhood or Arc tokens using the box above!
          </p>
        </div>

        <div v-else class="space-y-4">
          <!-- Post Item Card -->
          <article
            v-for="call in paginatedCallouts"
            :key="call.id"
            class="rounded-2xl border border-border bg-card hover:border-foreground/30 transition-all p-4 sm:p-5 space-y-3 shadow-2xs font-mono text-xs"
          >
            <!-- Author Row -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <Jazzicon :address="call.authorAddress" :size="28" class="shrink-0 rounded-full" />
                <div class="min-w-0 leading-tight">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                      class="font-bold text-foreground text-xs hover:underline cursor-pointer"
                      @click="navigateToCaller(call.authorAddress)"
                    >
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
                  <span class="text-[10px] text-muted-foreground"> Caller </span>
                </div>
              </div>

              <span class="text-[10px] text-muted-foreground shrink-0">
                {{ formatRelativeTime(call.createdAt) }}
              </span>
            </div>

            <!-- Post Message Text with Styled Cashtags -->
            <p
              class="text-xs sm:text-sm leading-relaxed text-foreground font-sans font-medium whitespace-pre-wrap break-words"
            >
              {{ call.content }}
            </p>

            <!-- Media Image (if any) -->
            <div
              v-if="call.imageUrl"
              class="rounded-xl overflow-hidden border border-border bg-muted/20 max-h-72 cursor-pointer"
              @click="openImage(call.imageUrl)"
            >
              <img :src="call.imageUrl" alt="Attachment" class="w-full h-full object-cover" />
            </div>

            <!-- The pump.fun Signature Embedded Coin Widget Card -->
            <div
              class="p-3.5 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 transition cursor-pointer flex items-center justify-between gap-3 text-xs font-mono"
              title="Click to view & trade token"
              @click="navigateToToken(call.tokenAddress)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <OptimizedImage
                  :src="call.tokenLogo"
                  :alt="call.tokenName || 'Token'"
                  :fallback-text="call.tokenSymbol || 'TOK'"
                  :width="36"
                  :height="36"
                  class="rounded-full border border-border shrink-0 shadow-2xs"
                />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 leading-none">
                    <span class="font-black text-foreground text-xs sm:text-sm">
                      ${{ call.tokenSymbol || 'TOKEN' }}
                    </span>
                    <span class="text-[10px] text-muted-foreground truncate hidden sm:inline">
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
                      Target: {{ call.targetMcap }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Caller Financial Stats: Position & Profit (pump.fun exact style) -->
              <div class="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <span class="text-[9px] text-muted-foreground block uppercase font-bold"
                    >Position</span
                  >
                  <span class="text-xs font-bold text-foreground">
                    {{ call.positionUsd ? `$${call.positionUsd.toFixed(1)}` : 'Holding' }}
                  </span>
                </div>
                <div v-if="call.profitUsd !== undefined">
                  <span class="text-[9px] text-muted-foreground block uppercase font-bold"
                    >Profit</span
                  >
                  <span
                    class="text-xs font-bold"
                    :class="call.profitUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                  >
                    {{ call.profitUsd >= 0 ? '+' : '' }}${{ call.profitUsd.toFixed(1) }}
                  </span>
                </div>
                <Button
                  size="sm"
                  class="h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
                  @click.stop="navigateToToken(call.tokenAddress)"
                >
                  Trade
                </Button>
              </div>
            </div>

            <!-- Social Action Bar (Like, Comment, Share on X) -->
            <div
              class="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground font-mono"
            >
              <button
                type="button"
                class="flex items-center gap-1.5 hover:text-rose-500 transition cursor-pointer select-none"
                :class="call.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
                @click="handleLike(call.id)"
              >
                <Heart
                  class="w-3.5 h-3.5"
                  :class="call.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
                />
                <span>{{ call.likesCount }}</span>
              </button>

              <button
                type="button"
                class="flex items-center gap-1 hover:text-foreground transition cursor-pointer select-none"
                @click="navigateToToken(call.tokenAddress)"
              >
                <MessageCircle class="w-3.5 h-3.5" />
                <span>Discuss</span>
              </button>

              <button
                type="button"
                class="flex items-center gap-1 hover:text-foreground transition cursor-pointer select-none"
                title="Share this call to X"
                @click="shareCallOnX(call)"
              >
                <Share2 class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Share on X</span>
              </button>
            </div>
          </article>
        </div>

        <!-- Pagination -->
        <div v-if="filteredCallouts.length > pageSize" class="flex justify-center pt-4">
          <Pagination
            :total="filteredCallouts.length"
            :items-per-page="pageSize"
            :page="currentPage"
            @update:page="currentPage = $event"
          />
        </div>
      </div>

      <!-- ============================================================
           RIGHT: Hot Callouts & Trending Alpha Sidebar (pump.fun style)
           ============================================================ -->
      <aside class="space-y-4 font-mono text-xs">
        <!-- Hot Tokens on Call Widget -->
        <div class="rounded-2xl border border-border bg-card p-4 space-y-3.5 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 font-bold text-foreground">
              <Flame class="w-4 h-4 text-amber-500" />
              <span>Hot Tokens on Call</span>
            </div>
            <span class="text-[10px] text-muted-foreground uppercase font-bold"
              >Robinhood / Arc</span
            >
          </div>

          <div v-if="hotTokens.length === 0" class="text-center py-6 text-muted-foreground text-xs">
            No hot calls yet today.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(tItem, idx) in hotTokens"
              :key="tItem.token.address"
              class="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition cursor-pointer"
              @click="navigateToToken(tItem.token.address)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-[10px] font-bold text-muted-foreground w-4 text-center">
                  #{{ idx + 1 }}
                </span>
                <OptimizedImage
                  :src="tItem.token.logo"
                  :alt="tItem.token.name"
                  :fallback-text="tItem.token.symbol"
                  :width="28"
                  :height="28"
                  class="rounded-full border border-border shrink-0"
                />
                <div class="min-w-0">
                  <div class="flex items-center gap-1 leading-tight">
                    <span class="font-black text-foreground text-xs"
                      >${{ tItem.token.symbol }}</span
                    >
                  </div>
                  <span class="text-[10px] text-muted-foreground truncate block">
                    {{ tItem.token.name }}
                  </span>
                </div>
              </div>

              <div class="text-right shrink-0">
                <span class="font-bold text-foreground block text-xs">
                  ${{ formatCompactUsd(tItem.marketData?.marketCapUsd || 4200) }}
                </span>
                <span
                  class="text-[10px] font-bold"
                  :class="
                    (tItem.marketData?.priceChange24h ?? 0) >= 0
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  "
                >
                  {{ (tItem.marketData?.priceChange24h ?? 0) >= 0 ? '+' : ''
                  }}{{ (tItem.marketData?.priceChange24h ?? 0).toFixed(1) }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- How Alpha Calls Work Card -->
        <div class="rounded-2xl border border-border bg-muted/30 p-4 space-y-2.5">
          <div class="flex items-center gap-1.5 font-bold text-foreground">
            <Sparkles class="w-4 h-4 text-primary" />
            <span>How Callouts Work</span>
          </div>
          <ul class="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed font-sans">
            <li>
              - <strong>Skin in the Game</strong>: Real caller token holdings are attached
              automatically.
            </li>
            <li>
              - <strong>Target Market Cap</strong>: Signal your exit price target directly to the
              community.
            </li>
            <li>
              - <strong>Transparent</strong>: 100% on-chain indexed data without synthetic or fake
              trading volume.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@/lib/i18n';
import { useWallet } from '../composables/useWallet';
import { useTokenStore } from '../composables/useTokenStore';
import { useFeed, type FeedFilterType } from '../composables/useFeed';
import {
  Megaphone,
  Search,
  RefreshCw,
  Loader2,
  Heart,
  Share2,
  Sparkles,
  ChevronDown,
  MessageCircle,
  Image as ImageIcon,
  Flame,
  AlertCircle,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Jazzicon } from '@/components/ui/avatar';
import { shortenAddress, formatRelativeTime, formatCompactUsd } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { FeedCalloutItem, LaunchedTokenEntity } from '@proto/shared-types';

const emit = defineEmits<{
  (e: 'select-token', address: string): void;
}>();

const { t } = useI18n();
const router = useRouter();
const { account, openWallet } = useWallet();
const { tokens: allTokens, fetchTokens } = useTokenStore();
const {
  callouts,
  loading,
  activeFilter,
  searchQuery,
  currentPage,
  pageSize,
  filteredCallouts,
  paginatedCallouts,
  fetchFeed,
  postCallout,
  toggleLike,
} = useFeed();

// Composer state
const composerContent = ref('');
const composerTargetMcap = ref('$100K MC');
const composerImageUrl = ref('');
const showMediaInput = ref(false);
const isPostingCall = ref(false);
const composerError = ref<string | null>(null);
const isTokenPickerOpen = ref(false);
const tokenSearchQuery = ref('');
const selectedToken = ref<LaunchedTokenEntity | null>(null);
const callerTokenBalance = ref<number>(0);
const checkingBalance = ref(false);

async function checkCallerPosition(tokenAddress: string): Promise<void> {
  if (!account.value || !tokenAddress) {
    callerTokenBalance.value = 0;
    return;
  }
  checkingBalance.value = true;
  try {
    const res = await fetch(`/api/tokens/${tokenAddress}/balance?account=${account.value}`);
    const data = await res.json();
    if (data.success && data.data) {
      callerTokenBalance.value = Number(data.data.balance || 0);
    } else {
      callerTokenBalance.value = 0;
    }
  } catch {
    callerTokenBalance.value = 0;
  } finally {
    checkingBalance.value = false;
  }
}

const filterTabs = computed<Array<{ key: FeedFilterType; label: string }>>(() => [
  { key: 'all', label: `All Calls (${callouts.value.length})` },
  { key: 'target', label: 'Price Targets' },
  { key: 'profit', label: 'In Profit' },
  { key: 'media', label: 'Media' },
]);

function handleFilterClick(key: FeedFilterType): void {
  activeFilter.value = key;
  currentPage.value = 1;
}

const availableTokensList = computed(() => {
  if (!allTokens.value) return [];
  if (!tokenSearchQuery.value.trim()) return allTokens.value.slice(0, 15);
  const q = tokenSearchQuery.value.trim().toLowerCase();
  return allTokens.value
    .filter(
      (tItem) =>
        tItem.token.symbol.toLowerCase().includes(q) ||
        tItem.token.name.toLowerCase().includes(q) ||
        tItem.token.address.toLowerCase().includes(q),
    )
    .slice(0, 15);
});

const hotTokens = computed(() => {
  if (!allTokens.value) return [];
  return [...allTokens.value]
    .sort((a, b) => (b.marketData?.marketCapUsd ?? 0) - (a.marketData?.marketCapUsd ?? 0))
    .slice(0, 5);
});

function pickToken(token: LaunchedTokenEntity): void {
  selectedToken.value = token;
  isTokenPickerOpen.value = false;
  checkCallerPosition(token.address);
  if (!composerContent.value) {
    composerContent.value = `Calling $${token.symbol} - target ${composerTargetMcap.value}!`;
  }
}

async function submitCallout(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  const content = composerContent.value.trim();
  if (!content) return;

  const targetToken = selectedToken.value || (allTokens.value?.[0]?.token ?? null);
  if (!targetToken) {
    composerError.value = 'Please select a token to call.';
    return;
  }

  if (callerTokenBalance.value <= 0) {
    composerError.value = `You must hold a position in $${targetToken.symbol} to post a callout. Please buy tokens first!`;
    return;
  }

  isPostingCall.value = true;
  composerError.value = null;

  try {
    const created = await postCallout({
      tokenAddress: targetToken.address,
      authorAddress: account.value,
      content,
      imageUrl: composerImageUrl.value.trim() || undefined,
      targetMcap: composerTargetMcap.value,
    });
    if (created) {
      toast.success(`Called $${targetToken.symbol}!`);
      composerContent.value = '';
      composerImageUrl.value = '';
      showMediaInput.value = false;
      await fetchFeed(account.value);
    }
  } catch (err) {
    composerError.value = (err as Error).message || 'Failed to post callout.';
  } finally {
    isPostingCall.value = false;
  }
}

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
    router.push(`/profile/${address}`);
  }
}

function shareCallOnX(call: FeedCalloutItem): void {
  if (typeof window !== 'undefined') {
    const symbolStr = call.tokenSymbol ? `$${call.tokenSymbol} ` : '';
    const targetStr = call.targetMcap ? `(Target: ${call.targetMcap}) ` : '';
    const tokenUrl = `${window.location.origin}/launchpad/${call.tokenAddress}`;
    const text = encodeURIComponent(
      `Check out this call on ${symbolStr}${targetStr}on @proto_protocol!\n\n"${call.content.slice(0, 120)}"\n\n${tokenUrl}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}

function openImage(url?: string): void {
  if (url && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

onMounted(async () => {
  await Promise.allSettled([fetchFeed(account.value || undefined), fetchTokens()]);
  if (allTokens.value?.length > 0 && !selectedToken.value) {
    selectedToken.value = allTokens.value[0].token;
  }
});
</script>
