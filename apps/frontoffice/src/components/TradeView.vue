<template>
  <!-- Full-width terminal layout, no outer max-width constraints -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Loading state -->
    <div
      v-if="tokenLoading"
      class="flex items-center justify-center py-32 text-muted-foreground gap-3"
    >
      <Loader2 class="w-5 h-5 animate-spin text-emerald-500" />
      <span class="text-sm font-medium">Loading token data...</span>
    </div>

    <!-- Token not found state -->
    <div
      v-else-if="tokenNotFound"
      class="flex flex-col items-center justify-center py-32 gap-4 text-center px-4"
    >
      <AlertCircle class="w-10 h-10 text-muted-foreground" />
      <div class="space-y-1">
        <p class="text-base font-semibold text-foreground">Token not found</p>
        <p class="text-xs text-muted-foreground">{{ props.tokenAddress }}</p>
        <p class="text-xs text-muted-foreground">
          This token has not been indexed yet or does not exist on this network.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- ============================================================
           PONS-INSPIRED UNIFIED TOKEN HEADER (app-token-head)
           ============================================================ -->
      <TradeHeader
        :current-token="currentToken"
        :current-market-data="currentMarketData"
        :currency-symbol="currencySymbol"
        :token-network="tokenNetwork"
        :explorer-url="explorerUrl"
        :primary-figure-mode="primaryFigureMode"
        :primary-figure-value="primaryFigureValue"
        :secondary-figure-value="secondaryFigureValue"
        :price-flash="priceFlash"
        :link-copied="linkCopied"
        :copied="copied"
        :is-pinned="isPinned"
        @open-call-modal="openCallModal"
        @share-to-x="shareToX"
        @copy-token-link="copyTokenLink"
        @toggle-pin="togglePin"
        @copy-address="copyAddress"
        @toggle-figure="toggleHeaderFigure"
      />

      <!-- Pending tax change warning - visible to all visitors -->
      <PendingTaxBanner
        v-if="hasPendingTax && pendingTax"
        :pending="pendingTax"
        :symbol="currentToken.symbol"
      />

      <!-- ============================================================
           HYBRID PONS X PROTO TRADING GRID
           - Desktop: 2 Columns (Col 1: Chart, Facts, Tabs | Col 2: Sticky Swap Panel)
           - Mobile: Responsive Stacking (Chart -> Swap Panel -> Facts -> Tabs)
           ============================================================ -->
      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <!-- 1. Chart Card (Col 1, Row 1 on xl) -->
        <div class="xl:col-start-1 xl:row-start-1 min-w-0 w-full space-y-6">
          <div class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <!-- Chart Header with Timeframe Pills -->
            <div
              class="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border/80 bg-card text-xs"
            >
              <!-- Timeframe switcher pills (Shadcn Buttons) -->
              <div class="flex items-center gap-1 bg-black p-0.5 rounded-xl border border-border">
                <Button
                  v-for="res in resolutions"
                  :key="res.label"
                  size="sm"
                  :variant="selectedResolution === res.seconds ? 'default' : 'ghost'"
                  class="h-7 px-2.5 text-xs font-bold rounded-lg"
                  @click="changeResolution(res.seconds)"
                >
                  {{ res.label }}
                </Button>
              </div>

              <!-- Pair Indicator -->
              <span class="text-xs text-muted-foreground font-sans hidden sm:inline">
                {{ currentToken.symbol }} / {{ currencySymbol }}
              </span>
            </div>

            <!-- TradingChart wrapper (Full bleed, no nested padding/border) -->
            <div class="w-full bg-card">
              <TradingChart
                :data="candlestickData"
                :loading="candlesLoading"
                :token-symbol="currentToken.symbol"
                :token-address="currentToken.address"
                :height="420"
                :resolution="selectedResolution"
                :total-supply="
                  currentToken.totalSupply && BigInt(currentToken.totalSupply) > 0n
                    ? Number(
                        BigInt(currentToken.totalSupply) /
                          10n ** BigInt(currentToken.decimals || 18),
                      )
                    : 1000000000
                "
                :is-graduated="currentMarketData.isGraduated"
                :markers="chartTradeMarkers"
              />
            </div>
          </div>
        </div>

        <!-- 2. Sticky Swap Panel (Mobile: 2nd under Chart; Desktop: Col 2, Row 1-3) -->
        <SwapPanel
          :current-token="currentToken"
          :currency-symbol="currencySymbol"
          :token-network="tokenNetwork"
          :active-network="activeNetwork"
          :is-connected="isConnected"
          :is-buy="isBuy"
          :user-holding-tokens-count="userHoldingTokensCount"
          :user-token-balance="userTokenBalance"
          :user-holding-usd="userHoldingUsd"
          :balance-wei="balanceWei"
          :amount-in="amountIn"
          :pay-in-usd="payInUsd"
          :is-token-balance-loading="isTokenBalanceLoading"
          :active-buy-presets="activeBuyPresets"
          :estimated-output-amount="estimatedOutputAmount"
          :slippage="slippage"
          :is-custom-slippage="isCustomSlippage"
          :custom-slippage-input="customSlippageInput"
          :slippage-warn-threshold="SLIPPAGE_WARN_THRESHOLD"
          :onchain-tax-config="onchainTaxConfig"
          :is-swap-disabled="isSwapDisabled"
          :is-swapping="isSwapping"
          :swap-button-text="swapButtonText"
          @update:trade-tab="tradeTab = $event"
          @update:amount-in="amountIn = $event"
          @update:pay-in-usd="payInUsd = $event"
          @update:slippage="slippage = $event"
          @update:is-custom-slippage="isCustomSlippage = $event"
          @update:custom-slippage-input="
            customSlippageInput = $event;
            handleCustomSlippageInput();
          "
          @apply-percentage="applyPercentage"
          @apply-quick-buy="applyQuickBuy"
          @open-wallet="openWallet"
          @switch-network="switchOrAddNetwork(tokenNetwork)"
          @execute-swap="handleSwap"
        />

        <!-- 3. Bonding Curve & Protocol Facts Card (Pons app-facts style) -->
        <div class="xl:col-start-1 xl:row-start-2 min-w-0 w-full space-y-6">
          <BondingCurveStats
            :current-token="currentToken"
            :current-market-data="currentMarketData"
            :currency-symbol="currencySymbol"
            :explorer-url="explorerUrl"
            :holders-count="holders.length"
            :top10-holding-percent="top10HoldingPercent"
            :dev-holding-percent="devHoldingPercent"
            :onchain-tax-config="onchainTaxConfig"
            :burned-info="burnedInfo"
            @copy-pair="copyAddress"
          />
        </div>

        <!-- 4. Bottom Tabs Card (Mobile: 4th; Desktop: Col 1, Row 3) -->
        <div class="xl:col-start-1 xl:row-start-3 min-w-0 w-full space-y-6">
          <div class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <Tabs v-model="activeBottomTab" class="w-full">
              <!-- Tab headers -->
              <div
                class="flex items-center justify-between border-b border-border px-3 sm:px-4 py-1.5 overflow-x-auto no-scrollbar gap-2"
              >
                <TabsList variant="line" class="flex gap-4 sm:gap-6 border-b-0 w-auto text-sm">
                  <TabsTrigger
                    v-for="tab in [
                      { value: 'callouts', label: 'Callouts' },
                      { value: 'trades', label: t('trades') },
                      { value: 'top-traders', label: t('topTraders') },
                      { value: 'holders', label: t('holders') },
                      { value: 'about', label: t('about') },
                    ]"
                    :key="tab.value"
                    :value="tab.value"
                  >
                    <span>{{ tab.label }}</span>
                    <span
                      v-if="tab.value === 'callouts' && callouts.length > 0"
                      class="ml-1 px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-bold text-xs"
                    >
                      {{ callouts.length }}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <Button
                  v-if="activeBottomTab === 'trades'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  @click="fetchTrades(currentToken.address)"
                >
                  <RefreshCw class="w-3.5 h-3.5 sm:mr-1" />
                  <span class="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  v-if="activeBottomTab === 'callouts'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  @click="fetchCallouts(currentToken.address)"
                >
                  <RefreshCw class="w-3.5 h-3.5 sm:mr-1" />
                  <span class="hidden sm:inline">Refresh</span>
                </Button>
              </div>

              <!-- Tab: Community Callouts (pump.fun style) -->
              <TabsContent value="callouts" class="mt-0">
                <TradeCalloutsTab
                  :current-token="currentToken"
                  :current-market-data="currentMarketData"
                  :callouts="callouts"
                  :paginated-callouts="paginatedCallouts"
                  :callouts-loading="calloutsLoading"
                  :callouts-page="calloutsPage"
                  :callouts-page-size="calloutsPageSize"
                  :is-holder-address="isHolderAddress"
                  :resolve-safe-url="resolveSafeUrl"
                  :format-views="formatViews"
                  @open-call-modal="openCallModal"
                  @open-thread-modal="openThreadModal"
                  @open-share-modal="openShareModal"
                  @toggle-like="toggleLike"
                  @update:callouts-page="calloutsPage = $event"
                />
              </TabsContent>

              <!-- Tab: Live Trades -->
              <TabsContent value="trades" class="mt-0 max-h-[340px] overflow-y-auto">
                <TradesTable
                  :trades="trades"
                  :loading="tradesLoading"
                  :currency-symbol="currencySymbol"
                  :deployer="currentToken.deployer"
                  :quote-asset-price-usd="quoteAssetPriceUsd"
                  :explorer-url="explorerUrl"
                />
              </TabsContent>

              <!-- Tab: Top Traders -->
              <TabsContent value="top-traders" class="mt-0 max-h-[340px] overflow-y-auto">
                <TopTradersTable
                  :top-traders="topTraders"
                  :loading="topTradersLoading"
                  :token-symbol="currentToken.symbol"
                  :token-price-usd="currentMarketData.priceUsd"
                />
              </TabsContent>

              <!-- Tab: Holders -->
              <TabsContent value="holders" class="mt-0 max-h-[340px] overflow-y-auto">
                <HoldersTable
                  :holders="holders"
                  :loading="holdersLoading"
                  :deployer="currentToken.deployer"
                  :locker-address="ROBINHOOD_CHAIN.contracts.locker"
                  :pool-address="currentToken.poolAddress"
                  :explorer-url="explorerUrl"
                />
              </TabsContent>

              <!-- Tab: About -->
              <TabsContent value="about" class="mt-0">
                <TradeAboutTab
                  :current-token="currentToken"
                  :current-market-data="currentMarketData"
                  :active-network="activeNetwork"
                  :explorer-url="explorerUrl"
                  :copied="copied"
                  :onchain-tax-config="onchainTaxConfig"
                  :is-creator="isCreator"
                  @copy-address="copyAddress"
                  @open-tax-modal="taxModalOpen = true"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <!-- Creator Tax Management Dialog -->
      <CreatorTaxModal
        v-model:open="taxModalOpen"
        v-model:edit-buy-tax="editBuyTax"
        v-model:edit-sell-tax="editSellTax"
        v-model:edit-tax-recipient="editTaxRecipient"
        :current-token="currentToken"
        :account="account || undefined"
        :pending-tax="pendingTax"
        :has-pending-tax="hasPendingTax"
        :tax-is-ready="taxIsReady"
        :tax-seconds-until-ready="taxSecondsUntilReady"
        :tax-action-loading="taxActionLoading"
        :tax-error="taxError"
        :updating-tax="updatingTax"
        @accept-tax="handleAcceptTax"
        @cancel-tax="handleCancelTax"
        @update-tax="handleUpdateTax"
      />

      <!-- Callout Modal (pump.fun style) -->
      <CalloutModal
        v-model:open="callModalOpen"
        v-model:call-content="callContent"
        v-model:call-image-url="callImageUrl"
        v-model:call-share-to-x="callShareToX"
        :current-token="currentToken"
        :current-market-data="currentMarketData"
        :user-holding-tokens-count="userHoldingTokensCount"
        :user-holding-usd="userHoldingUsd"
        :has-sufficient-holding-for-comment="hasSufficientHoldingForComment"
        :user-token-balance="userTokenBalance"
        :account="account || undefined"
        :call-error="callError"
        :is-posting-call="isPostingCall"
        @post-callout="handlePostCallout"
        @go-to-buy="goToBuyFromCall"
      />

      <!-- Share Sheet & Thread Modals -->
      <ShareModal
        :is-open="isShareModalOpen"
        :call="activeShareCall"
        @close="isShareModalOpen = false"
      />

      <ThreadModal
        :is-open="isThreadModalOpen"
        :target-call="activeThreadCall"
        :account="account"
        :tokens="[{ token: currentToken }]"
        @close="isThreadModalOpen = false"
        @toggle-like="toggleLike"
        @share="openShareModal"
        @reply-posted="onReplyPosted"
      />

      <!-- Mobile Sticky Quick Trade Floating Dock (Mobile only: sm:hidden) -->
      <MobileTradeDock
        :current-token="currentToken"
        :current-market-data="currentMarketData"
        @scroll-to-swap="scrollToSwap"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { parseAbi, parseEther, erc20Abi } from 'viem';
import { useI18n } from '@/lib/i18n';
import { apiFetch } from '@/lib/api-client';
import {
  ArrowUpDown,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Settings,
  ExternalLink,
  Sparkles,
  Send,
  Heart,
  RefreshCw,
  Globe,
  ArrowRight,
  Megaphone,
  Share2,
  MessageCircle,
  BarChart2,
  Star,
  ChevronLeft,
} from 'lucide-vue-next';
import { useSwap, SLIPPAGE_WARN_THRESHOLD, parseAmountToWei } from '../composables/useSwap';
import { useTokenStream } from '../composables/useTokenStream';
import { useWallet } from '../composables/useWallet';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useTaxConfig } from '../composables/useTaxConfig';
import { usePinnedTokens } from '../composables/usePinnedTokens';
import { useFeed } from '../composables/useFeed';
import { getPublicClient } from '../lib/viem-client';
import { toast } from '@/components/ui/sonner';
import { Badge, TraderTagBadge, type TraderTagType } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Jazzicon } from '@/components/ui/avatar';
import PendingTaxBanner from './tax/PendingTaxBanner.vue';
import TaxTimelockPanel from './tax/TaxTimelockPanel.vue';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import { Empty } from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { TradingChart } from '@/components/ui/chart';
import { CashtagText, ShareModal, ThreadModal } from '@/components/feed';
import {
  TradesTable,
  TopTradersTable,
  HoldersTable,
  BondingCurveStats,
  TradeHeader,
  SwapPanel,
  CreatorTaxModal,
  CalloutModal,
  TradeAboutTab,
  TradeCalloutsTab,
  MobileTradeDock,
} from './trade';
import {
  shortenAddress,
  formatTokenNumber,
  formatRelativeTime,
  formatCompactUsd,
  formatPriceUsd,
  formatSubscriptPrice,
} from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  SUPPORTED_CHAINS,
  ARC_PROTO_CURVE_ADDRESS,
  resolveTokenNetwork,
  launchpadTokenAbi,
  launchpadV2FactoryAbi,
  bondingCurveAbi,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TokenCommentEntity,
  type FeedCalloutItem,
  type TradeEventEntity,
} from '@proto/shared-types';
import {
  calculateCurveBuyOutput,
  calculateCurveSellOutput,
  calculateRealizedPnl,
  calculateTraderTotalPnl,
  ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI,
  ARC_INITIAL_VIRTUAL_ETH_WEI,
} from '@proto/math-sdk';

const props = defineProps<{
  tokenAddress?: string;
}>();

const { t } = useI18n();

// Suppress unused import warning - SLIPPAGE_WARN_THRESHOLD is used directly in the template
// to keep the threshold in sync with useSwap without duplicating the magic number.

interface LiveTrade {
  id: string;
  tokenAddress: string;
  poolAddress: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  wethAmount: string;
  priceUsd: number;
  blockNumber: string;
  transactionHash: string;
  timestamp: number;
}

interface TokenHolder {
  address: string;
  balance: string;
  percent: number;
}

const { executeSwap, isSwapping, swapError, slippage } = useSwap();
const {
  isConnected,
  account,
  balanceWei,
  activeNetwork,
  switchOrAddNetwork,
  openWallet,
  updateBalance,
} = useWallet();

const { setTokenTax } = useLaunchpad();

const {
  pending: pendingTax,
  hasPending: hasPendingTax,
  isReady: taxIsReady,
  secondsUntilReady: taxSecondsUntilReady,
  actionLoading: taxActionLoading,
  error: taxError,
  loadPendingTax,
  acceptTaxConfig,
  cancelTaxConfig,
} = useTaxConfig();

async function handleAcceptTax() {
  const hash = await acceptTaxConfig(currentToken.value.address);
  if (hash) {
    toast.success('Tax configuration applied onchain');
    await loadOnchainTax(currentToken.value.address);
  } else if (taxError.value) {
    toast.error('Failed to apply tax config: ' + taxError.value);
  }
}

async function handleCancelTax() {
  const hash = await cancelTaxConfig(currentToken.value.address);
  if (hash) {
    toast.success('Tax proposal cancelled');
  } else if (taxError.value) {
    toast.error('Failed to cancel tax proposal: ' + taxError.value);
  }
}

const isCreator = computed(() => {
  if (!account.value || !currentToken.value.deployer) return false;
  return account.value.toLowerCase() === currentToken.value.deployer.toLowerCase();
});

// Callout State (pump.fun style)
const callModalOpen = ref(false);
const callTargetMcap = ref('$100K MC');
const callContent = ref('');
const callImageUrl = ref('');
const callShareToX = ref(true);
const isPostingCall = ref(false);
const callError = ref<string | null>(null);

const userHoldingTokensCount = computed(() => {
  const decimals = currentToken.value.decimals || 18;
  return Number(userTokenBalance.value) / 10 ** decimals;
});

const effectiveTokenPriceUsd = computed(() => {
  if (currentMarketData.value.priceUsd > 0) {
    return currentMarketData.value.priceUsd;
  }
  const { vEth, vToken } = getVirtualReserves();
  if (vToken > 0 && vEth > 0) {
    const spotEth = vEth / vToken;
    const ethUsd = quoteAssetPriceUsd.value || 2700;
    return spotEth * ethUsd;
  }
  return 0;
});

const userHoldingUsd = computed(() => {
  return userHoldingTokensCount.value * effectiveTokenPriceUsd.value;
});

const MIN_HOLD_USD_FOR_COMMENT = 1.0;
const hasSufficientHoldingForComment = computed(() => {
  if (isCreator.value) return true;
  return userHoldingUsd.value >= MIN_HOLD_USD_FOR_COMMENT * 0.95;
});

function openCallModal(): void {
  callModalOpen.value = true;
  callError.value = null;
}

function goToBuyFromCall(): void {
  callModalOpen.value = false;
  tradeTab.value = 'buy';
  payInUsd.value = true;
  const neededUsd = Math.max(1, Math.ceil(1 - userHoldingUsd.value));
  amountIn.value = String(neededUsd);
  scrollToSwap('buy');
}

async function handlePostCallout(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  if (!hasSufficientHoldingForComment.value) {
    callError.value = `Anti-spam: You must hold at least $1.00 worth of $${currentToken.value.symbol} to comment. (Current holding: $${userHoldingUsd.value.toFixed(2)})`;
    return;
  }
  const content = callContent.value.trim();
  if (!content) {
    callError.value = 'Please write a comment or thesis.';
    return;
  }

  isPostingCall.value = true;
  callError.value = null;
  try {
    const { postCallout } = useFeed();
    const created = await postCallout({
      tokenAddress: currentToken.value.address,
      authorAddress: account.value,
      content,
      imageUrl: callImageUrl.value.trim() || undefined,
      targetMcap: callTargetMcap.value,
      positionUsd: userHoldingUsd.value > 0 ? userHoldingUsd.value : undefined,
      callType: 'call',
    });

    if (created) {
      toast.success(`Called $${currentToken.value.symbol}!`);

      if (callShareToX.value && typeof window !== 'undefined') {
        const tweetText = encodeURIComponent(
          `I just called $${currentToken.value.symbol} at ${formatCompactUsd(currentMarketData.value.marketCapUsd || 4200)} MC (Target: ${callTargetMcap.value}) on @proto_protocol!\n\n"${content.slice(0, 100)}"\n\n${window.location.href}`,
        );
        window.open(
          `https://twitter.com/intent/tweet?text=${tweetText}`,
          '_blank',
          'noopener,noreferrer',
        );
      }

      callContent.value = '';
      callImageUrl.value = '';
      callModalOpen.value = false;
      activeBottomTab.value = 'callouts';
      await fetchCallouts(currentToken.value.address);
    } else {
      callError.value = 'Failed to publish callout.';
    }
  } catch (err) {
    callError.value = (err as Error).message || 'Network error.';
  } finally {
    isPostingCall.value = false;
  }
}

// Social Modals state
const isShareModalOpen = ref(false);
const activeShareCall = ref<FeedCalloutItem | null>(null);
const isThreadModalOpen = ref(false);
const activeThreadCall = ref<FeedCalloutItem | null>(null);

function formatViews(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val || 0);
}

function openShareModal(cmt: TokenCommentEntity) {
  activeShareCall.value = {
    ...cmt,
    tokenName: currentToken.value.name,
    tokenSymbol: currentToken.value.symbol,
    tokenLogo: currentToken.value.logo,
    tokenMarketCapUsd: currentMarketData.value?.marketCapUsd,
    tokenPriceUsd: currentMarketData.value?.priceUsd,
  };
  isShareModalOpen.value = true;
}

function openThreadModal(cmt: TokenCommentEntity) {
  activeThreadCall.value = {
    ...cmt,
    tokenName: currentToken.value.name,
    tokenSymbol: currentToken.value.symbol,
    tokenLogo: currentToken.value.logo,
    tokenMarketCapUsd: currentMarketData.value?.marketCapUsd,
    tokenPriceUsd: currentMarketData.value?.priceUsd,
  };
  isThreadModalOpen.value = true;
}

function onReplyPosted(reply: FeedCalloutItem) {
  if (activeThreadCall.value) {
    activeThreadCall.value.repliesCount = (activeThreadCall.value.repliesCount || 0) + 1;
  }
  const rootItem = callouts.value.find((c) => c.id === reply.parentId);
  if (rootItem) {
    rootItem.repliesCount = (rootItem.repliesCount || 0) + 1;
  }
}

function shareCalloutToX(cmt: TokenCommentEntity) {
  if (typeof window !== 'undefined') {
    const target = cmt.targetMcap ? `(Target: ${cmt.targetMcap}) ` : '';
    const text = encodeURIComponent(
      `Check out this call on $${currentToken.value.symbol} ${target}on @proto_protocol!\n\n"${cmt.content.slice(0, 120)}"\n\n${window.location.href}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}

// Watchlist Pin Feature (shared singleton composable)
const { isPinned, togglePin } = usePinnedTokens();

function resolveSafeUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('ipfs://')) {
    const hash = trimmed.replace('ipfs://', '');
    return `/api/ipfs/${hash}`;
  }
  return trimmed;
}

function isHolderAddress(addr: string): boolean {
  if (!addr || holders.value.length === 0) return false;
  return holders.value.some((h) => h.address.toLowerCase() === addr.toLowerCase());
}

const onchainTaxConfig = ref({
  buyTaxBps: 0,
  sellTaxBps: 0,
  taxRecipient: '',
});

const taxModalOpen = ref(false);
const editBuyTax = ref('1');
const editSellTax = ref('1');
const editTaxRecipient = ref('');
const updatingTax = ref(false);

async function loadOnchainTax(tokenAddr: `0x${string}`) {
  try {
    const client = getPublicClient(tokenNetwork.value.chainId);
    const cfg = (await client.readContract({
      address: tokenAddr,
      abi: launchpadTokenAbi,
      functionName: 'taxConfig',
    })) as [number, number, string];
    if (cfg && (Number(cfg[0]) > 0 || Number(cfg[1]) > 0)) {
      onchainTaxConfig.value = {
        buyTaxBps: Number(cfg[0]),
        sellTaxBps: Number(cfg[1]),
        taxRecipient: cfg[2],
      };
      editBuyTax.value = String(Number(cfg[0]) / 100);
      editSellTax.value = String(Number(cfg[1]) / 100);
      editTaxRecipient.value = cfg[2];
    } else if (
      currentToken.value?.taxConfig?.buyTaxBps ||
      currentToken.value?.taxConfig?.sellTaxBps
    ) {
      const fallbackBuy = currentToken.value.taxConfig.buyTaxBps ?? 0;
      const fallbackSell = currentToken.value.taxConfig.sellTaxBps ?? 0;
      const fallbackRecipient = currentToken.value.taxConfig.taxRecipient || cfg?.[2] || '';
      onchainTaxConfig.value = {
        buyTaxBps: fallbackBuy,
        sellTaxBps: fallbackSell,
        taxRecipient: fallbackRecipient,
      };
      editBuyTax.value = String(fallbackBuy / 100);
      editSellTax.value = String(fallbackSell / 100);
      editTaxRecipient.value = fallbackRecipient;
    }
  } catch {
    // Non-blocking
  }
}

async function handleUpdateTax() {
  if (!account.value) return;
  updatingTax.value = true;
  try {
    const buyVal = parseFloat(editBuyTax.value || '0');
    const sellVal = parseFloat(editSellTax.value || '0');
    const recipient = (editTaxRecipient.value.trim() as `0x${string}`) || account.value;
    const hash = await setTokenTax(currentToken.value.address, buyVal, sellVal, recipient);
    if (hash) {
      toast.success('Tax change proposed — activates in 24 hours', {
        description: `Buy Tax: ${buyVal}%, Sell Tax: ${sellVal}%`,
      });
      await loadOnchainTax(currentToken.value.address);
      await loadPendingTax(currentToken.value.address, tokenNetwork.value.chainId);
      taxModalOpen.value = false;
    }
  } catch (err) {
    toast.error('Failed to update tax: ' + (err as Error).message);
  } finally {
    updatingTax.value = false;
  }
}

const currentToken = ref<LaunchedTokenEntity>({
  address: (props.tokenAddress as `0x${string}`) || '0x0000000000000000000000000000000000000000',
  name: '',
  symbol: '',
  decimals: 18,
  totalSupply: '0',
  logo: '',
  description: '',
  socials: {},
  deployer: '0x0000000000000000000000000000000000000000',
  pairedToken: '0x0000000000000000000000000000000000000000',
  poolAddress: '0x0000000000000000000000000000000000000000',
  isToken0: true,
  poolFee: 10000,
  positionId: 0n,
  restrictionsEndBlock: 0n,
  launchBlock: 0n,
  createdAt: 0,
});

const currentMarketData = ref<TokenMarketData>({
  address: currentToken.value.address,
  priceInWeth: 0,
  priceUsd: 0,
  marketCapUsd: 0,
  fdvUsd: 0,
  pairedPrincipalWeth: '0.0000',
  graduationThresholdWeth: '4.2',
  graduationProgress: 0,
  isGraduated: false,
  volume24hUsd: 0,
});

const tokenNetwork = computed(() =>
  resolveTokenNetwork(currentToken.value, activeNetwork.value.chainId),
);

const isArcToken = computed(() => tokenNetwork.value.chainId === ARC_CHAIN.chainId);

const currencySymbol = computed(() => tokenNetwork.value.nativeCurrency.symbol);
const explorerUrl = computed(() => tokenNetwork.value.blockExplorer);
const buyPresets = computed(() => {
  return currencySymbol.value === 'USDC'
    ? ['10', '50', '100', '500']
    : ['0.01', '0.05', '0.1', '0.5'];
});

// Holders & trader data
const holders = ref<TokenHolder[]>([]);
const holdersLoading = ref(false);
const topTraders = ref<
  Array<{
    address: string;
    buyVolumeUsd: number;
    sellVolumeUsd: number;
    totalTrades: number;
    profitUsd: number;
    isDev: boolean;
    walletTag: string;
    firstBuyTimestamp?: number;
    firstBuyPriceUsd?: number;
    avgCostUsd?: number;
    holdingAmountTokens?: string;
    positionStatus?: 'holding' | 'partial' | 'clean_all';
  }>
>([]);
const topTradersLoading = ref(false);

const devInfo = ref({
  creatorAddress: '',
  initialBuyEth: '0.00',
  currentHoldPercent: 0,
  creatorStatus: 'none',
  totalDevSoldEth: '0.00',
  hasRenounced: false,
});

const devHoldingPercent = computed(() => {
  if (!currentToken.value.deployer || holders.value.length === 0) return 0;
  const dev = holders.value.find(
    (h) => h.address.toLowerCase() === currentToken.value.deployer.toLowerCase(),
  );
  return dev ? dev.percent : 0;
});

const top10HoldingPercent = computed(() => {
  if (holders.value.length === 0) return 0;
  return holders.value.slice(0, 10).reduce((acc, h) => acc + h.percent, 0);
});

const burnedInfo = computed(() => {
  if (holders.value.length === 0) return { amount: 0, percent: 0 };
  const dead = holders.value.find(
    (h) =>
      h.address.toLowerCase() === '0x000000000000000000000000000000000000dead' ||
      h.address.toLowerCase() === '0x0000000000000000000000000000000000000000',
  );
  if (!dead) return { amount: 0, percent: 0 };
  return { amount: dead.balance, percent: dead.percent };
});

const quoteAssetPriceUsd = computed(() => {
  if (isArcToken.value) return 1;
  if (currentMarketData.value.priceInWeth > 0) {
    return currentMarketData.value.priceUsd / currentMarketData.value.priceInWeth;
  }
  return 2700;
});

const remainingToGraduate = computed(() => {
  const current = Number(currentMarketData.value.pairedPrincipalWeth || 0);
  const target = Number(
    currentMarketData.value.graduationThresholdWeth ||
      (currencySymbol.value === 'USDC' ? 69000 : 4.2),
  );
  const diff = Math.max(0, target - current);
  return currencySymbol.value === 'USDC' ? diff.toFixed(0) : diff.toFixed(3);
});

const chartTradeMarkers = computed(() => {
  if (!trades.value || trades.value.length === 0) return [];
  return trades.value.slice(0, 20).map((t) => {
    let ts = t.timestamp;
    if (ts > 2_000_000_000) ts = Math.floor(ts / 1000);
    return {
      time: ts,
      position: (t.isBuy ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
      color: t.isBuy ? '#22c55e' : '#ef4444',
      shape: (t.isBuy ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
      text: t.isBuy ? 'B' : 'S',
      size: 1,
    };
  });
});

// Trade state
const tradeTab = ref<'buy' | 'sell'>('buy');
const isBuy = computed(() => tradeTab.value === 'buy');
const payInUsd = ref(false);
const chartDisplayMode = ref<'price' | 'mcap'>('price');
const chartCurrencyMode = ref<'usd' | 'native'>('usd');

const primaryFigureMode = ref<'mcap' | 'price'>('mcap');
function toggleHeaderFigure(): void {
  primaryFigureMode.value = primaryFigureMode.value === 'mcap' ? 'price' : 'mcap';
}
const primaryFigureValue = computed(() => {
  if (primaryFigureMode.value === 'mcap') {
    return '$' + formatNumberCap(currentMarketData.value.marketCapUsd ?? 4200);
  }
  return formatPriceUsd(currentMarketData.value.priceUsd);
});
const secondaryFigureValue = computed(() => {
  if (primaryFigureMode.value === 'mcap') {
    return formatPriceUsd(currentMarketData.value.priceUsd) + ' price';
  }
  return '$' + formatNumberCap(currentMarketData.value.marketCapUsd ?? 4200) + ' mcap';
});

const activeChartHeaderPrice = computed(() => {
  if (chartDisplayMode.value === 'mcap') {
    return formatCompactUsd(currentMarketData.value.marketCapUsd || 4200);
  }
  if (chartCurrencyMode.value === 'native') {
    const val = currentMarketData.value.priceInWeth || 0;
    if (val < 0.00000001) return `${val.toFixed(11)} ${currencySymbol.value}`;
    if (val < 0.0001) return `${val.toFixed(8)} ${currencySymbol.value}`;
    return `${val.toFixed(6)} ${currencySymbol.value}`;
  }
  return formatPriceUsd(currentMarketData.value.priceUsd);
});

const amountIn = ref('10');
const tokenNotFound = ref(false);
const swapSuccessTx = ref<string | null>(null);
const copied = ref(false);
const copiedId = ref<string | null>(null);
const tokenLoading = ref(true);
const activeBottomTab = ref<'callouts' | 'trades' | 'top-traders' | 'holders' | 'about'>('trades');

const priceFlash = ref<'up' | 'down' | null>(null);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

function triggerPriceFlash(direction: 'up' | 'down') {
  priceFlash.value = direction;
  if (flashTimeout) clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => {
    priceFlash.value = null;
  }, 1200);
}

function scrollToSwap(tab: 'buy' | 'sell') {
  tradeTab.value = tab;
  const el = document.getElementById('swap-panel-container');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const effectiveNativeInput = computed(() => {
  const input = parseFloat(amountIn.value) || 0;
  if (input <= 0) return 0;
  if (isBuy.value && payInUsd.value) {
    return input / (quoteAssetPriceUsd.value || 1);
  }
  return input;
});

const activeBuyPresets = computed(() => {
  if (payInUsd.value) {
    return ['10', '50', '100', '500'];
  }
  return buyPresets.value;
});

// Trades
const trades = ref<LiveTrade[]>([]);
const tradesLoading = ref(false);

const userTokenBalance = ref<bigint>(0n);
const isTokenBalanceLoading = ref(false);
const isMaxSell = ref(false);

// Slippage
const isCustomSlippage = ref(false);
const customSlippageInput = ref('');

// Callouts State
const callouts = ref<TokenCommentEntity[]>([]);
const calloutsLoading = ref(false);

// Pagination state for Callouts bottom tab
const calloutsPage = ref(1);
const calloutsPageSize = 10;
const paginatedCallouts = computed(() => {
  const start = (calloutsPage.value - 1) * calloutsPageSize;
  return callouts.value.slice(start, start + calloutsPageSize);
});

watch(callouts, (list) => {
  const max = Math.max(1, Math.ceil(list.length / calloutsPageSize));
  if (calloutsPage.value > max) calloutsPage.value = 1;
});

// Resolution & candle data
const resolutions = [
  { label: '1s', seconds: 1 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '4h', seconds: 14400 },
  { label: '1d', seconds: 86400 },
];
const TIMEFRAME_STORAGE_KEY = 'proto_chart_resolution';

function loadSavedResolution(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const val = localStorage.getItem(TIMEFRAME_STORAGE_KEY);
    if (val) {
      const num = parseInt(val, 10);
      if ([1, 60, 300, 900, 3600, 14400, 86400].includes(num)) return num;
    }
  } catch {
    // Ignore storage errors
  }
  return 1; // 1s default for real-time sub-second memecoin action
}

const selectedResolution = ref(loadSavedResolution());
const candlesLoading = ref(false);
const candlestickData = ref<
  Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
>([]);
let livePollTimer: ReturnType<typeof setTimeout> | null = null;
let livePollActive = false;
let liveAbort: AbortController | null = null;

// ---------------------------------------------------------------------------
// SSE — primary realtime channel for market data.
// Polling loop below remains active as fallback for candlesticks + tab data.
// ---------------------------------------------------------------------------
const {
  streamMarketData,
  isStreamConnected: _sseConnected,
  connect: connectStream,
  disconnect: disconnectStream,
} = useTokenStream(() => currentToken.value.address);

// Merge SSE market data into local reactive state using the same delta-check
// as refreshLive() to avoid spurious Vue reactivity updates.
watch(streamMarketData, (incoming) => {
  if (!incoming) return;
  const curr = currentMarketData.value;
  const changed =
    incoming.priceUsd !== curr.priceUsd ||
    incoming.priceInWeth !== curr.priceInWeth ||
    incoming.marketCapUsd !== curr.marketCapUsd ||
    incoming.volume24hUsd !== curr.volume24hUsd ||
    incoming.isGraduated !== curr.isGraduated ||
    incoming.graduationProgress !== curr.graduationProgress;
  if (changed) currentMarketData.value = incoming;
});

/** Returns the poll interval in ms based on the currently selected chart resolution.
 * Coarser timeframes update less frequently — the candle bucket does not change
 * until the next period boundary anyway, so polling faster is pure waste.
 * When SSE is connected this poll loop only refreshes candlesticks + tab data,
 * NOT market price (that comes through the stream).
 */
function getLivePollIntervalMs(): number {
  const res = selectedResolution.value;
  if (res <= 1) return 3_000; // 1-second chart — stay near-realtime
  if (res <= 60) return 5_000; // 1-minute chart
  if (res <= 300) return 15_000; // 5-minute chart
  return 30_000; // 15m / 1h / 4h / 1d — coarse; save server load
}

async function refreshLive() {
  if (livePollActive) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (tokenLoading.value || !currentToken.value.address) return;
  const addr = currentToken.value.address;

  livePollActive = true;
  liveAbort?.abort();
  liveAbort = new AbortController();
  const { signal } = liveAbort;

  try {
    const env = await apiFetch<{
      success: boolean;
      data: { token: LaunchedTokenEntity; marketData: TokenMarketData };
    }>(`/api/tokens/${addr}`, { signal });
    if (env.success && env.data && addr === currentToken.value.address) {
      const incomingMkt = env.data.marketData;
      if (incomingMkt) {
        const curr = currentMarketData.value;
        const changed =
          incomingMkt.priceUsd !== curr.priceUsd ||
          incomingMkt.priceInWeth !== curr.priceInWeth ||
          incomingMkt.marketCapUsd !== curr.marketCapUsd ||
          incomingMkt.volume24hUsd !== curr.volume24hUsd ||
          incomingMkt.isGraduated !== curr.isGraduated ||
          incomingMkt.graduationProgress !== curr.graduationProgress;

        if (changed) {
          currentMarketData.value = incomingMkt;
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }

  // Fire candlestick + active-tab fetches in parallel to halve per-cycle latency.
  // Each function is already guard-wrapped with silent=true (no spinner, merge-only).
  const tabFetch =
    activeBottomTab.value === 'trades'
      ? fetchTrades(addr, true)
      : activeBottomTab.value === 'top-traders'
        ? fetchTopTraders(addr, true)
        : activeBottomTab.value === 'holders'
          ? fetchHolders(addr, true)
          : Promise.resolve();

  await Promise.allSettled([fetchCandlesticks(addr, selectedResolution.value, true), tabFetch]);

  livePollActive = false;
}

function scheduleNextLivePoll() {
  if (livePollTimer) {
    clearTimeout(livePollTimer);
    livePollTimer = null;
  }
  if (typeof document !== 'undefined' && document.hidden) return;
  livePollTimer = setTimeout(async () => {
    await refreshLive();
    scheduleNextLivePoll();
  }, getLivePollIntervalMs());
}

function onVisibility() {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    if (livePollTimer) {
      clearTimeout(livePollTimer);
      livePollTimer = null;
    }
    liveAbort?.abort();
    livePollActive = false;
  } else {
    refreshLive().then(() => scheduleNextLivePoll());
  }
}

// -----------------------------------------------------------------------
// Bonding curve AMM preview math
// Mirrors BondingCurve.sol constants exactly:
//   CURVE_TOKEN_SUPPLY = 800_000_000 (tokens allocated to curve, not wei)
//   POOL_RESERVE_SUPPLY = 200_000_000 (reserved for V4 LP)
//   fee = 1% (100 bps)
// -----------------------------------------------------------------------
const CURVE_TOKEN_SUPPLY = 800_000_000; // tokens (not wei)

function getVirtualReserves() {
  const vEthRaw = currentToken.value.virtualEthReserve;
  const vTokenRaw = currentToken.value.virtualTokenReserve;
  if (vEthRaw && vTokenRaw) {
    const vEth = Number(BigInt(vEthRaw)) / 1e18;
    const vToken = Number(BigInt(vTokenRaw)) / 10 ** (currentToken.value.decimals || 18);
    if (vEth > 0 && vToken > 0) {
      return { vEth, vToken };
    }
  }
  // Fallback: reconstruct from pairedPrincipalWeth + contract initial virtual reserves.
  // BondingCurve constructor: virtualEthReserve = 3 ETH (Robinhood) / 4200 USDC (Arc),
  // virtualTokenReserve = CURVE_TOKEN_SUPPLY = 800_000_000.
  const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
  const isArc = currencySymbol.value === 'USDC';
  const baseVirtualEth =
    Number(isArc ? ARC_INITIAL_VIRTUAL_ETH_WEI : ROBINHOOD_INITIAL_VIRTUAL_ETH_WEI) / 1e18;
  return {
    vEth: baseVirtualEth + currentRaised,
    vToken: CURVE_TOKEN_SUPPLY,
  };
}

function computeCurveBuyOutput(ethIn: number): number {
  if (ethIn <= 0) return 0;
  const { vEth, vToken } = getVirtualReserves();
  return calculateCurveBuyOutput(ethIn, vEth, vToken);
}

function computeCurveSellOutput(tokensIn: number): number {
  if (tokensIn <= 0) return 0;
  const { vEth, vToken } = getVirtualReserves();
  return calculateCurveSellOutput(tokensIn, vEth, vToken);
}

const estimatedOutputAmount = computed(() => {
  const input = effectiveNativeInput.value;
  if (input <= 0) return '0';

  const isV2OnCurve =
    (currentToken.value.version === 'v2' || Boolean(currentToken.value.curveAddress)) &&
    !currentMarketData.value.isGraduated;

  if (isBuy.value) {
    const tokens = isV2OnCurve
      ? computeCurveBuyOutput(input)
      : input / (currentMarketData.value.priceInWeth || 0.000001);
    return tokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else {
    const weth = isV2OnCurve
      ? computeCurveSellOutput(input)
      : input * (currentMarketData.value.priceInWeth || 0);
    const decimals = currencySymbol.value === 'USDC' ? 2 : 6;
    return weth.toFixed(decimals);
  }
});

const estimatedOutput = computed(() => {
  return `${estimatedOutputAmount.value} ${isBuy.value ? currentToken.value.symbol : currencySymbol.value}`;
});

const swapButtonText = computed(() => {
  if (isSwapping.value) return 'Executing...';
  if (!isConnected.value) return t('connectWallet');
  if (activeNetwork.value.chainId !== tokenNetwork.value.chainId) {
    return `Switch to ${tokenNetwork.value.name}`;
  }
  const input = effectiveNativeInput.value;
  if (!amountIn.value || input <= 0) return 'Enter an amount';

  if (!isBuy.value) {
    if (userTokenBalance.value <= 0n) {
      return `Insufficient ${currentToken.value.symbol} balance`;
    }
    if (!isMaxSell.value) {
      const decimals = currentToken.value.decimals || 18;
      const inputWei = parseAmountToWei(amountIn.value, decimals);
      if (inputWei > userTokenBalance.value) {
        return `Insufficient ${currentToken.value.symbol} balance`;
      }
    }
    return `Sell ${currentToken.value.symbol}`;
  } else {
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance > 0 && input > ethBalance) {
      return `Insufficient ${currencySymbol.value} balance`;
    }
    return `Buy ${currentToken.value.symbol}`;
  }
});

const isSwapDisabled = computed(() => {
  if (isSwapping.value) return true;
  if (!isConnected.value) return false;
  if (activeNetwork.value.chainId !== tokenNetwork.value.chainId) return false;
  const input = parseFloat(amountIn.value) || 0;
  if (!amountIn.value || input <= 0) return true;
  if (!isBuy.value) {
    if (userTokenBalance.value <= 0n) return true;
    if (!isMaxSell.value) {
      const decimals = currentToken.value.decimals || 18;
      const inputWei = parseAmountToWei(amountIn.value, decimals);
      return inputWei > userTokenBalance.value;
    }
    return false;
  }
  const ethBalance = Number(balanceWei.value) / 1e18;
  if (ethBalance > 0 && input > ethBalance) return true;
  return false;
});

// -----------------------------------------------------------------------
// UI Helpers
// -----------------------------------------------------------------------
function applyQuickBuy(val: string) {
  amountIn.value = val;
}

function applyPercentage(percent: number) {
  if (isBuy.value) {
    isMaxSell.value = false;
    const isUsdQuote =
      currencySymbol.value === 'USDC' ||
      currencySymbol.value === 'USDT' ||
      currencySymbol.value === 'USDG';
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance <= 0) {
      amountIn.value = '0';
      return;
    }
    const reserveGas = isUsdQuote ? 0.05 : 0.005;
    const maxEth =
      percent === 100 ? Math.max(0, ethBalance - reserveGas) : ethBalance * (percent / 100);
    const nativeVal = maxEth > 0 ? maxEth : ethBalance;
    if (payInUsd.value) {
      amountIn.value = (nativeVal * (quoteAssetPriceUsd.value || 1)).toFixed(2);
    } else {
      amountIn.value = nativeVal.toFixed(isUsdQuote ? 2 : 4);
    }
  } else {
    const decimals = currentToken.value.decimals || 18;
    if (userTokenBalance.value <= 0n) {
      amountIn.value = '0';
      isMaxSell.value = false;
      return;
    }
    if (percent === 100) {
      isMaxSell.value = true;
      const whole = userTokenBalance.value / 10n ** BigInt(decimals);
      const frac = userTokenBalance.value % 10n ** BigInt(decimals);
      const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
      amountIn.value = fracStr ? `${whole}.${fracStr}` : whole.toString();
    } else {
      isMaxSell.value = false;
      const tokenBal = Number(userTokenBalance.value) / 10 ** decimals;
      const calculated = tokenBal * (percent / 100);
      amountIn.value = calculated < 1 ? calculated.toFixed(6) : calculated.toFixed(2);
    }
  }
}

function selectSlippagePreset(val: number) {
  slippage.value = val;
  isCustomSlippage.value = false;
  customSlippageInput.value = '';
}

function handleCustomSlippageInput() {
  const val = parseFloat(customSlippageInput.value);
  if (!isNaN(val) && val > 0 && val <= 49) {
    slippage.value = val;
  } else if (!isNaN(val) && val > 49) {
    slippage.value = 49;
    customSlippageInput.value = '49';
  }
}

function formatEthBalance(wei: bigint): string {
  const isUsdQuote =
    currencySymbol.value === 'USDC' ||
    currencySymbol.value === 'USDT' ||
    currencySymbol.value === 'USDG';
  const val = Number(wei) / 1e18;
  if (val === 0) return isUsdQuote ? '0.00' : '0.0000';
  if (isUsdQuote) return val < 0.01 ? val.toFixed(4) : val.toFixed(2);
  return val < 0.0001 ? val.toFixed(6) : val.toFixed(4);
}

function formatTokenBalance(wei: bigint): string {
  const decimals = currentToken.value.decimals || 18;
  const val = Number(wei) / 10 ** decimals;
  if (val === 0) return '0.00';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.0001) return val.toFixed(4);
  return val.toFixed(6);
}

function copyText(text: string, id: string) {
  navigator.clipboard.writeText(text);
  copiedId.value = id;
  setTimeout(() => {
    if (copiedId.value === id) copiedId.value = null;
  }, 2000);
}

function copyAddress(addr?: string | Event) {
  if (typeof navigator !== 'undefined') {
    const textToCopy = typeof addr === 'string' && addr ? addr : currentToken.value.address;
    navigator.clipboard.writeText(textToCopy);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}

const linkCopied = ref(false);
function copyTokenLink() {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    navigator.clipboard.writeText(window.location.href);
    linkCopied.value = true;
    toast.success('Link copied to clipboard');
    setTimeout(() => {
      linkCopied.value = false;
    }, 2000);
  }
}

function shareToX() {
  if (typeof window !== 'undefined') {
    const text = encodeURIComponent(
      `Trading $${currentToken.value.symbol} on @proto_protocol on ${tokenNetwork.value.name}!\n${window.location.href}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}

function formatNumberCap(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

// -----------------------------------------------------------------------
// Data Fetching
// -----------------------------------------------------------------------
let balanceFetchPromise: Promise<void> | null = null;
let lastBalanceFetchTime = 0;

async function fetchUserTokenBalance(force = false) {
  const currentAcc = account.value;
  const tokenAddr = currentToken.value.address;
  if (!currentAcc || !tokenAddr || tokenAddr === '0x0000000000000000000000000000000000000000') {
    userTokenBalance.value = 0n;
    return;
  }
  const now = Date.now();
  if (balanceFetchPromise) return balanceFetchPromise;
  if (!force && now - lastBalanceFetchTime < 2500) return;
  lastBalanceFetchTime = now;

  // Never flicker if balance is already loaded
  if (userTokenBalance.value === 0n) {
    isTokenBalanceLoading.value = true;
  }

  balanceFetchPromise = (async () => {
    try {
      const [onChainResult, backendResult] = await Promise.allSettled([
        getPublicClient(tokenNetwork.value.chainId).readContract({
          address: tokenAddr as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [currentAcc as `0x${string}`],
        }) as Promise<bigint>,
        apiFetch<{ success: boolean; data: { balanceWei: string } } | null>(
          `/api/tokens/${tokenAddr}/balance?account=${currentAcc}&chain=${tokenNetwork.value.chainId}`,
        ).catch(() => null),
      ]);

      let resolvedBal: bigint | null = null;
      if (onChainResult.status === 'fulfilled' && onChainResult.value > 0n) {
        resolvedBal = onChainResult.value;
      } else if (
        backendResult.status === 'fulfilled' &&
        backendResult.value?.success &&
        backendResult.value?.data?.balanceWei
      ) {
        resolvedBal = BigInt(backendResult.value.data.balanceWei);
      } else if (onChainResult.status === 'fulfilled') {
        resolvedBal = onChainResult.value;
      }

      if (resolvedBal !== null) {
        userTokenBalance.value = resolvedBal;
      }
    } catch {
      // Non-blocking
    } finally {
      isTokenBalanceLoading.value = false;
      balanceFetchPromise = null;
    }
  })();

  return balanceFetchPromise;
}

async function fetchTrades(address: string, silent = false) {
  if (!silent) tradesLoading.value = true;
  try {
    const envelope = await apiFetch<{ success: boolean; data: LiveTrade[] }>(
      `/api/tokens/${address}/trades?limit=50`,
    );
    if (envelope.success && Array.isArray(envelope.data)) {
      const incoming = envelope.data;
      const current = trades.value;
      const isDifferent =
        incoming.length !== current.length ||
        (incoming.length > 0 && current.length > 0 && incoming[0].id !== current[0].id);

      if (isDifferent) {
        trades.value = incoming;
      }
    } else if (!silent) {
      trades.value = [];
    }
  } catch {
    if (!silent) trades.value = [];
  } finally {
    if (!silent) tradesLoading.value = false;
  }
}

async function fetchHolders(address: string, silent = false) {
  if (!silent) holdersLoading.value = true;
  try {
    const envelope = await apiFetch<{ success: boolean; data: TokenHolder[] }>(
      `/api/tokens/${address}/holders?limit=50`,
    );
    if (envelope.success && Array.isArray(envelope.data)) {
      const incoming = envelope.data;
      const current = holders.value;
      const isDifferent =
        incoming.length !== current.length ||
        (incoming.length > 0 && current.length > 0 && incoming[0].address !== current[0].address);

      if (isDifferent) {
        holders.value = incoming;
      }
    } else if (!silent) {
      holders.value = [];
    }
  } catch {
    if (!silent) holders.value = [];
  } finally {
    if (!silent) holdersLoading.value = false;
  }
}

async function fetchTopTraders(address: string, silent = false) {
  if (!silent) topTradersLoading.value = true;
  try {
    const envelope = await apiFetch<{ success: boolean; data: typeof topTraders.value }>(
      `/api/tokens/${address}/top-traders?limit=20`,
    );
    if (envelope.success && Array.isArray(envelope.data)) {
      const incoming = envelope.data;
      const current = topTraders.value;
      const isDifferent =
        incoming.length !== current.length ||
        (incoming.length > 0 && current.length > 0 && incoming[0].address !== current[0].address);

      if (isDifferent) {
        topTraders.value = incoming;
      }
    } else if (!silent) {
      topTraders.value = [];
    }
  } catch {
    if (!silent) topTraders.value = [];
  } finally {
    if (!silent) topTradersLoading.value = false;
  }
}

async function fetchDevActivity(address: string) {
  try {
    const envelope = await apiFetch<{ success: boolean; data: typeof devInfo.value }>(
      `/api/tokens/${address}/dev-activity`,
    );
    if (envelope.success && envelope.data) devInfo.value = envelope.data;
  } catch {
    // non-blocking
  }
}

// -----------------------------------------------------------------------
// Community Callouts Fetcher & Reaction
// -----------------------------------------------------------------------
async function fetchCallouts(address: string) {
  calloutsLoading.value = true;
  try {
    const viewerParam = account.value ? `?viewer=${account.value}` : '';
    const envelope = await apiFetch<{ success: boolean; data: FeedCalloutItem[] }>(
      `/api/tokens/${address}/comments${viewerParam}`,
    );
    if (envelope.success && Array.isArray(envelope.data)) {
      callouts.value = envelope.data;
    }
  } catch {
    callouts.value = [];
  } finally {
    calloutsLoading.value = false;
  }
}

async function toggleLike(commentId: string) {
  if (!account.value) {
    openWallet();
    return;
  }
  try {
    const envelope = await apiFetch<{
      success: boolean;
      data: { liked: boolean; likesCount: number };
    }>(`/api/tokens/${currentToken.value.address}/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: account.value }),
    });
    if (envelope.success && envelope.data) {
      const call = callouts.value.find((c) => c.id === commentId);
      if (call) {
        call.isLikedByViewer = envelope.data.liked;
        call.likesCount = envelope.data.likesCount;
      }
    }
  } catch {
    // Non-blocking
  }
}

// -----------------------------------------------------------------------
// Multi-Timeframe Candlestick Engine (1m, 5m, 15m, 1h, 4h, 1d)
// Continuous timeline from token release to now
// -----------------------------------------------------------------------
async function fetchCandlesticks(address: string, resolutionSeconds = 1, silent = false) {
  // silent=true → live poll: no loading spinner, only merge last 1-2 candles in-place
  // silent=false → full load: show spinner, replace entire dataset
  type CandleRow = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };

  function parseCandleRow(c: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }): CandleRow {
    return {
      time: Math.floor(c.timestamp / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
    };
  }

  function patchLivePrice(rows: CandleRow[], priceUsd: number, resolution: number): void {
    // Patch the current open bucket with live price without creating a new array reference
    if (rows.length === 0 || priceUsd <= 0) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const currentBucket = Math.floor(nowSec / resolution) * resolution;
    const last = rows[rows.length - 1];
    if (last.time === currentBucket) {
      last.close = priceUsd;
      last.high = Math.max(last.high, priceUsd);
      last.low = Math.min(last.low, priceUsd);
    } else if (currentBucket > last.time) {
      rows.push({
        time: currentBucket,
        open: last.close,
        high: Math.max(last.close, priceUsd),
        low: Math.min(last.close, priceUsd),
        close: priceUsd,
        volume: 0,
      });
    }
  }

  try {
    if (!silent) candlesLoading.value = true;
    const envelope = await apiFetch<{
      success: boolean;
      data: Array<{
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume?: number;
      }>;
    }>(`/api/tokens/${address}/ohlcv?resolution=${resolutionSeconds}&fillGaps=true`);
    if (resolutionSeconds !== selectedResolution.value) return; // Discard stale timeframe response

    if (envelope.success && Array.isArray(envelope.data) && envelope.data.length > 0) {
      const incoming: CandleRow[] = envelope.data.map(parseCandleRow);
      const livePrice = currentMarketData.value.priceUsd;
      patchLivePrice(incoming, livePrice, resolutionSeconds);

      if (silent && candlestickData.value.length > 0) {
        // Incremental merge: only update/append the last 1-2 bars — no full setData() on chart
        const existing = candlestickData.value;
        const lastIncoming = incoming[incoming.length - 1];
        const secondLastIncoming = incoming.length > 1 ? incoming[incoming.length - 2] : null;
        let changed = false;

        // Update second-to-last if it closed a new bucket
        if (secondLastIncoming) {
          const idx = existing.findIndex((b) => b.time === secondLastIncoming.time);
          if (idx === -1) {
            existing.push(secondLastIncoming);
            changed = true;
          } else if (
            existing[idx].close !== secondLastIncoming.close ||
            existing[idx].volume !== secondLastIncoming.volume
          ) {
            existing[idx] = secondLastIncoming;
            changed = true;
          }
        }

        // Update or append the latest (open) bucket
        const lastIdx = existing.findIndex((b) => b.time === lastIncoming.time);
        if (lastIdx === -1) {
          existing.push(lastIncoming);
          changed = true;
        } else if (
          existing[lastIdx].close !== lastIncoming.close ||
          existing[lastIdx].high !== lastIncoming.high ||
          existing[lastIdx].low !== lastIncoming.low ||
          existing[lastIdx].volume !== lastIncoming.volume
        ) {
          existing[lastIdx] = lastIncoming;
          changed = true;
        }

        // Shallow-copy the array to trigger Vue reactivity only when content changed
        if (changed) {
          if (existing.length > 1000) {
            existing.splice(0, existing.length - 1000);
          }
          candlestickData.value = [...existing];
        }
      } else {
        // Full replace on initial load or timeframe change
        candlestickData.value = incoming;
      }
      return;
    }

    // No trade data: synthesize a baseline from creation price
    if (!silent && currentMarketData.value.priceUsd > 0) {
      const tokenCreatedSec = currentToken.value.createdAt
        ? Math.floor(currentToken.value.createdAt / 1000)
        : Math.floor(Date.now() / 1000) - 3600;
      const nowSec = Math.floor(Date.now() / 1000);
      const start = Math.floor(tokenCreatedSec / resolutionSeconds) * resolutionSeconds;
      const end = Math.floor(nowSec / resolutionSeconds) * resolutionSeconds;
      const price = currentMarketData.value.priceUsd;

      const baseline: CandleRow[] = [
        { time: start, open: price, high: price, low: price, close: price, volume: 0 },
      ];
      if (end > start) {
        baseline.push({ time: end, open: price, high: price, low: price, close: price, volume: 0 });
      }
      candlestickData.value = baseline;
      return;
    }

    if (!silent) candlestickData.value = [];
  } catch {
    if (!silent) candlestickData.value = [];
  } finally {
    if (!silent) candlesLoading.value = false;
  }
}

async function changeResolution(seconds: number) {
  if (seconds === selectedResolution.value) return;
  selectedResolution.value = seconds;
  try {
    localStorage.setItem(TIMEFRAME_STORAGE_KEY, String(seconds));
  } catch {
    // Ignore storage errors
  }
  // Clear stale data immediately so TradingChart receives empty array → full reset on new data
  candlestickData.value = [];
  candlesLoading.value = true;
  await fetchCandlesticks(currentToken.value.address, seconds);
}

async function handleSwap() {
  swapSuccessTx.value = null;
  let expectedAmountOut: bigint | undefined;
  const input = effectiveNativeInput.value;
  const isV2OnCurve =
    (currentToken.value.version === 'v2' || Boolean(currentToken.value.curveAddress)) &&
    !currentMarketData.value.isGraduated;

  if (input > 0 && currentMarketData.value.priceInWeth > 0) {
    if (isBuy.value) {
      const estimatedTokens = isV2OnCurve
        ? computeCurveBuyOutput(input)
        : input / (currentMarketData.value.priceInWeth || 0.000001);
      expectedAmountOut = parseEther(Math.max(0, estimatedTokens).toFixed(6));
    } else {
      const estimatedEth = isV2OnCurve
        ? computeCurveSellOutput(input)
        : input * (currentMarketData.value.priceInWeth || 0);
      expectedAmountOut = parseEther(Math.max(0, estimatedEth).toFixed(6));
    }
  }

  let loadingToastId: string | number | undefined;

  const hash = await executeSwap({
    tokenAddress: currentToken.value.address,
    isBuy: isBuy.value,
    amountInEth:
      !isBuy.value && isMaxSell.value
        ? userTokenBalance.value
        : isBuy.value
          ? effectiveNativeInput.value.toString()
          : amountIn.value,
    slippagePercent: slippage.value,
    expectedAmountOut,
    curveAddress: currentToken.value.curveAddress,
    isGraduated: currentMarketData.value.isGraduated,
    chainId: tokenNetwork.value.chainId,
    tokenDecimals: currentToken.value.decimals || 18,
    onApproveSubmitted: (approveHash) => {
      toast.info('Approval Submitted', {
        description: 'Approving tokens for trading...',
        action: {
          label: 'View on Explorer',
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.open(
                `${explorerUrl.value}/tx/${approveHash}`,
                '_blank',
                'noopener,noreferrer',
              );
            }
          },
        },
        duration: 5000,
      });
    },
    onSubmitted: (txHash) => {
      loadingToastId = toast.loading(
        isBuy.value ? 'Processing Buy Order...' : 'Processing Sell Order...',
        {
          description: 'Transaction broadcasted. Waiting for block confirmation...',
          action: {
            label: 'View on Explorer',
            onClick: () => {
              if (typeof window !== 'undefined') {
                window.open(`${explorerUrl.value}/tx/${txHash}`, '_blank', 'noopener,noreferrer');
              }
            },
          },
        },
      );

      // Trigger immediate background sync — fire-and-forget, non-blocking
      apiFetch<unknown>(`/api/tokens/${currentToken.value.address}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      }).catch(() => {});
    },
  });

  if (hash) {
    swapSuccessTx.value = hash;
    isMaxSell.value = false;

    const txExplorerLink = `${explorerUrl.value}/tx/${hash}`;
    toast.success('Swap Confirmed', {
      id: loadingToastId,
      description: isBuy.value
        ? `Successfully bought ${currentToken.value.symbol || 'tokens'}!`
        : `Successfully sold ${currentToken.value.symbol || 'tokens'}!`,
      action: {
        label: 'View on Explorer',
        onClick: () => {
          if (typeof window !== 'undefined') {
            window.open(txExplorerLink, '_blank', 'noopener,noreferrer');
          }
        },
      },
      duration: 8000,
    });

    try {
      await apiFetch<unknown>(`/api/tokens/${currentToken.value.address}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash }),
      });
    } catch {
      // non-blocking
    }
    await loadTokenData(currentToken.value.address);
    await Promise.allSettled([
      updateBalance(),
      fetchUserTokenBalance(true),
      fetchTrades(currentToken.value.address, true),
      fetchCandlesticks(currentToken.value.address, selectedResolution.value, true),
      fetchHolders(currentToken.value.address, true),
      fetchTopTraders(currentToken.value.address, true),
    ]);

    // Fast realtime sync poll for 6s in background
    for (let i = 1; i <= 3; i++) {
      setTimeout(async () => {
        await Promise.allSettled([
          updateBalance(),
          fetchUserTokenBalance(true),
          fetchTrades(currentToken.value.address, true),
          fetchCandlesticks(currentToken.value.address, selectedResolution.value, true),
        ]);
      }, i * 2000);
    }
  } else if (swapError.value) {
    toast.error('Swap Failed', {
      id: loadingToastId,
      description: swapError.value,
      duration: 6000,
    });
  }
}

async function loadTokenData(address: `0x${string}`) {
  tokenLoading.value = true;
  tokenNotFound.value = false;
  let loaded = false;

  try {
    const envelope = await apiFetch<{
      success: boolean;
      data: { token: LaunchedTokenEntity; marketData: TokenMarketData };
    }>(`/api/tokens/${address}`);
    if (envelope.success && envelope.data) {
      currentToken.value = envelope.data.token;
      currentMarketData.value = envelope.data.marketData;
      loaded = true;
    }
  } catch {
    // non-blocking fallback
  }

  // Direct On-Chain Hydration Fallback:
  // If backend is catching up or returns 404, hydrate token & bonding curve directly from chain
  if (!loaded) {
    try {
      const chainsToTry = Object.values(SUPPORTED_CHAINS);

      for (const network of chainsToTry) {
        if (loaded) break;
        const client = getPublicClient(network.chainId);
        const factories = [network.contracts.factoryV2, network.contracts.factory].filter(
          (f): f is `0x${string}` =>
            Boolean(f && f !== '0x0000000000000000000000000000000000000000'),
        );

        for (const factory of factories) {
          try {
            const launch = (await client.readContract({
              address: factory,
              abi: launchpadV2FactoryAbi,
              functionName: 'launches',
              args: [address],
            })) as [`0x${string}`, `0x${string}`, `0x${string}`, bigint, boolean];

            const curveAddress = launch[1];
            if (curveAddress && curveAddress !== '0x0000000000000000000000000000000000000000') {
              const [name, symbol, decimals, totalSupply, vEth, vToken, raised, target, grad] =
                await Promise.all([
                  client.readContract({ address, abi: erc20Abi, functionName: 'name' }),
                  client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
                  client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
                  client.readContract({ address, abi: erc20Abi, functionName: 'totalSupply' }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'virtualEthReserve',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'virtualTokenReserve',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'totalEthRaised',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'graduationTarget',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'graduated',
                  }),
                ]);

              const vEthNum = Number(vEth) / 1e18;
              const vTokenNum = Number(vToken) / 10 ** (decimals || 18);
              const spotPrice = vTokenNum > 0 ? vEthNum / vTokenNum : 0;
              const isStableQuote =
                network.nativeCurrency.symbol === 'USDC' ||
                network.nativeCurrency.symbol === 'USDT';
              const quoteUsd = isStableQuote ? 1.0 : 2500;
              const priceUsd = spotPrice * quoteUsd;

              currentToken.value = {
                address,
                name: name as string,
                symbol: symbol as string,
                decimals: decimals || 18,
                totalSupply: totalSupply.toString(),
                logo: '',
                description: '',
                socials: {},
                deployer: launch[2],
                pairedToken: network.contracts.weth,
                poolAddress: curveAddress,
                isToken0: false,
                poolFee: 10000,
                positionId: 0n,
                restrictionsEndBlock: 0n,
                launchBlock: 0n,
                createdAt: Number(launch[3]) * 1000,
                version: 'v2',
                curveAddress,
                virtualEthReserve: vEth.toString(),
                virtualTokenReserve: vToken.toString(),
                graduationTarget: target.toString(),
                initialBuyAmount: raised.toString(),
                isGraduated: grad as boolean,
              };

              const raisedEth = Number(raised) / 1e18;
              const targetEth = Number(target) / 1e18;
              const supplyTokens = Number(totalSupply) / 10 ** (Number(decimals) || 18);
              currentMarketData.value = {
                address,
                priceInWeth: spotPrice,
                priceUsd,
                marketCapUsd: priceUsd * supplyTokens,
                fdvUsd: priceUsd * supplyTokens,
                pairedPrincipalWeth: raisedEth.toFixed(4),
                graduationThresholdWeth: targetEth.toFixed(2),
                graduationProgress: targetEth > 0 ? (raisedEth / targetEth) * 100 : 0,
                isGraduated: grad as boolean,
                volume24hUsd: 0,
              };
              loaded = true;
              break;
            }
          } catch {
            // continue checking next factory
          }
        }
      }
    } catch {
      // fallback
    }

    if (!loaded) {
      tokenNotFound.value = true;
    }
  }

  await Promise.allSettled([
    fetchCandlesticks(address, selectedResolution.value),
    fetchTrades(address),
    fetchTopTraders(address),
    fetchDevActivity(address),
    fetchHolders(address),
    fetchCallouts(address),
    loadOnchainTax(address),
    loadPendingTax(address, tokenNetwork.value.chainId),
  ]);
  tokenLoading.value = false;
}

// Reset amount and success state when switching between buy and sell tabs
// to avoid unit confusion (ETH vs token amount).
watch(tradeTab, (newTab) => {
  amountIn.value = '';
  payInUsd.value = false;
  isMaxSell.value = false;
  swapSuccessTx.value = null;
  if (newTab === 'sell') {
    fetchUserTokenBalance(true);
  }
});

watch(
  () => props.tokenAddress,
  async (newAddress) => {
    if (newAddress && newAddress !== currentToken.value.address) {
      currentToken.value.address = newAddress as `0x${string}`;
      await loadTokenData(newAddress as `0x${string}`);
      await Promise.allSettled([
        fetchUserTokenBalance(true),
        updateBalance(undefined, tokenNetwork.value.chainId, true),
      ]);
    }
  },
);

watch(
  () => account.value,
  (newAcc, oldAcc) => {
    if (newAcc && newAcc !== oldAcc) {
      Promise.allSettled([
        fetchUserTokenBalance(true),
        updateBalance(undefined, tokenNetwork.value.chainId, true),
        fetchCallouts(currentToken.value.address),
      ]);
    } else if (!newAcc) {
      userTokenBalance.value = 0n;
    }
  },
);

watch(
  () => tokenNetwork.value.chainId,
  (newChainId) => {
    if (account.value) {
      Promise.allSettled([updateBalance(undefined, newChainId, true), fetchUserTokenBalance(true)]);
    }
  },
);

watch(
  () => [currentMarketData.value.priceUsd, currentMarketData.value.priceInWeth],
  ([newPriceUsd], [oldPriceUsd]) => {
    // Trigger price flash animation only — candle update is handled inside fetchCandlesticks(silent)
    if (newPriceUsd && oldPriceUsd && Number(newPriceUsd) !== Number(oldPriceUsd)) {
      triggerPriceFlash(Number(newPriceUsd) >= Number(oldPriceUsd) ? 'up' : 'down');
    }
  },
);

onMounted(async () => {
  const addr = (props.tokenAddress as `0x${string}`) || currentToken.value.address;
  if (addr && addr !== '0x0000000000000000000000000000000000000000') {
    currentToken.value.address = addr;
    await loadTokenData(addr);
    await Promise.allSettled([
      fetchUserTokenBalance(true),
      updateBalance(undefined, tokenNetwork.value.chainId, true),
    ]);
  }

  // Open SSE stream first so market price arrives via push;
  // poll loop handles candlesticks + tab data as complementary channel.
  connectStream();
  scheduleNextLivePoll();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }
});

onUnmounted(() => {
  // Close SSE connection before poll cleanup so no stale frame arrives
  // after the component has been torn down.
  disconnectStream();
  if (livePollTimer) {
    clearTimeout(livePollTimer);
    livePollTimer = null;
  }
  liveAbort?.abort();
  livePollActive = false;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility);
  }
});
</script>
