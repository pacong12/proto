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

      <!-- Buy vs sell pressure from real trades (Binance-style B% / S%) -->
      <TradeFlowGauge :token-address="currentToken.address" />

      <!-- ============================================================
           HYBRID PONS X GOTON TRADING GRID
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
          :closed-position="closedPosition"
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
          :unclaimed-dividend-formatted="unclaimedDividendFormatted"
          :is-claiming-dividends="isClaimingDividends"
          :is-dividends-configured="isDividendsConfigured"
          :has-dividends="hasDividends"
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
          @claim-dividends="handleClaimDividends"
          @open-pnl-card="isPnlModalOpen = true"
        >
          <template v-if="limitOrdersEnabled" #order-type>
            <div class="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
              <button
                v-for="o in ORDER_TYPES"
                :key="o.value"
                type="button"
                role="tab"
                class="min-h-8 rounded-lg text-xs font-bold transition cursor-pointer"
                :class="
                  orderType === o.value
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                "
                :aria-selected="orderType === o.value"
                @click="orderType = o.value"
              >
                {{ t(o.label) }}
              </button>
            </div>
          </template>
          <template v-if="limitOrdersEnabled && orderType !== 'market'" #alternate-form>
            <LimitOrderPanel
              :mode="orderType === 'limit' ? 'limit' : 'tpsl'"
              :token="currentToken"
              :market-data="currentMarketData"
              :network="tokenNetwork"
              :account="account"
              :user-token-balance="userTokenBalance"
              :buy-tax-bps="onchainTaxConfig.buyTaxBps"
              :sell-tax-bps="onchainTaxConfig.sellTaxBps"
              @created="ordersRefresh++"
              @open-wallet="openWallet"
            />
          </template>
          <template v-if="limitOrdersEnabled && account" #after-card>
            <div class="rounded-2xl border border-border bg-card p-4">
              <OpenOrders
                :token="currentToken.address"
                :symbol="currentToken.symbol"
                :network="tokenNetwork"
                :account="account"
                :refresh-key="ordersRefresh"
              />
            </div>
          </template>
        </SwapPanel>

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
                  :locker-address="tokenNetwork.contracts.locker"
                  :pool-address="currentToken.poolAddress"
                  :curve-address="currentToken.curveAddress"
                  :decimals="currentToken.decimals ?? 18"
                  :is-graduated="!!currentMarketData.isGraduated"
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
                <TeamPayouts
                  class="mt-4"
                  :token="currentToken.address"
                  :symbol="currentToken.symbol"
                  :network="tokenNetwork"
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

      <!-- PnL Card Share Modal -->
      <PnlCardModal
        :is-open="isPnlModalOpen"
        :wallet="account || undefined"
        :token="currentToken.address"
        @close="isPnlModalOpen = false"
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
import { resolveSafeUrl } from '@/lib/safe-url';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from '@/lib/i18n';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-vue-next';
import { SLIPPAGE_WARN_THRESHOLD } from '@/composables/useSwap';
import { useWallet } from '@/composables/useWallet';
import { usePnlShare } from '@/composables/usePnlShare';
import { usePinnedTokens } from '@/composables/usePinnedTokens';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import PendingTaxBanner from '@/components/tax/PendingTaxBanner.vue';
import TeamPayouts from '@/components/trade/TeamPayouts.vue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TradingChart } from '@/components/ui/chart';
import { ShareModal, ThreadModal } from '@/components/feed';
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
  TradeFlowGauge,
  LimitOrderPanel,
  OpenOrders,
  PnlCardModal,
} from '@/components/trade';
import { setPageSeo } from '@/lib/seo';
import {
  resolveTokenNetwork,
  isStableSymbol,
  type LaunchedTokenEntity,
  type TokenMarketData,
  isIndexableToken,
  seoChainName,
  tokenSeoDescription,
} from '@goton/shared-types';

import type { TradePage } from '@/composables/trade/types';

import { useTradeMarket } from '@/composables/trade/useTradeMarket';
import { fetchTradeToken } from '@/composables/trade/token-source';

import { useTradeTax } from '@/composables/trade/useTradeTax';

import { useTradeDividends } from '@/composables/trade/useTradeDividends';

import { useTradeOrderRoutes } from '@/composables/trade/useTradeOrderRoutes';

import { useTradeForm } from '@/composables/trade/useTradeForm';

import { useTradeCallouts } from '@/composables/trade/useTradeCallouts';

const props = defineProps<{
  tokenAddress?: string;
}>();
const { t } = useI18n();
const {
  isConnected,
  account,
  balanceWei,
  activeNetwork,
  switchOrAddNetwork,
  openWallet,
  updateBalance,
} = useWallet();
const isCreator = computed(() => {
  if (!account.value || !currentToken.value.deployer) return false;
  return account.value.toLowerCase() === currentToken.value.deployer.toLowerCase();
});
// Watchlist Pin Feature (shared singleton composable)
const { isPinned, togglePin } = usePinnedTokens();
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
const currencySymbol = computed(() => tokenNetwork.value.nativeCurrency.symbol);
const explorerUrl = computed(() => tokenNetwork.value.blockExplorer);
const buyPresets = computed(() => {
  return isStableSymbol(currencySymbol.value)
    ? ['10', '50', '100', '500']
    : ['0.01', '0.05', '0.1', '0.5'];
});
const tokenNotFound = ref(false);
const copied = ref(false);
const tokenLoading = ref(true);
const activeBottomTab = ref<'callouts' | 'trades' | 'top-traders' | 'holders' | 'about'>('trades');
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
      `Trading $${currentToken.value.symbol} on @gotondotfun on ${tokenNetwork.value.name}!\n${window.location.href}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}

const page: TradePage = {
  activeBottomTab,
  buyPresets,
  currencySymbol,
  currentMarketData,
  currentToken,
  explorerUrl,
  isCreator,
  refreshTokenData,
  tokenLoading,
  tokenNetwork,
};

const tradeMarket = useTradeMarket(page);
const {
  burnedInfo,
  candlesLoading,
  candlestickData,
  changeResolution,
  devHoldingPercent,
  fetchCandlesticks,
  fetchDevActivity,
  fetchHolders,
  fetchTopTraders,
  fetchTrades,
  holders,
  holdersLoading,
  isHolderAddress,
  priceFlash,
  primaryFigureMode,
  primaryFigureValue,
  quoteAssetPriceUsd,
  resolutions,
  secondaryFigureValue,
  selectedResolution,
  toggleHeaderFigure,
  top10HoldingPercent,
  topTraders,
  topTradersLoading,
  trades,
  tradesLoading,
  triggerPriceFlash,
} = tradeMarket;

const tradeTax = useTradeTax(page);
const {
  editBuyTax,
  editSellTax,
  editTaxRecipient,
  handleAcceptTax,
  handleCancelTax,
  handleUpdateTax,
  hasPendingTax,
  loadOnchainTax,
  loadPendingTax,
  onchainTaxConfig,
  pendingTax,
  taxActionLoading,
  taxError,
  taxIsReady,
  taxModalOpen,
  taxSecondsUntilReady,
  updatingTax,
} = tradeTax;

const tradeDividends = useTradeDividends(page);
const {
  handleClaimDividends,
  hasDividends,
  isClaimingDividends,
  isDividendsConfigured,
  isPnlModalOpen,
  refreshLiveDividends,
  unclaimedDividend,
  unclaimedDividendFormatted,
} = tradeDividends;

const tradeOrderRoutes = useTradeOrderRoutes(page);
const { ORDER_TYPES, limitOrdersEnabled, orderType, ordersRefresh } = tradeOrderRoutes;

const tradeForm = useTradeForm(page, tradeMarket, tradeTax, tradeDividends);
const {
  activeBuyPresets,
  amountIn,
  applyPercentage,
  applyQuickBuy,
  customSlippageInput,
  estimatedOutputAmount,
  fetchUserTokenBalance,
  handleCustomSlippageInput,
  handleSwap,
  isBuy,
  isCustomSlippage,
  isMaxSell,
  isSwapDisabled,
  isSwapping,
  isTokenBalanceLoading,
  payInUsd,
  scrollToSwap,
  slippage,
  swapButtonText,
  swapSuccessTx,
  tradeTab,
  userTokenBalance,
} = tradeForm;

const tradeCallouts = useTradeCallouts(page, tradeMarket, tradeForm);
const {
  activeShareCall,
  activeThreadCall,
  callContent,
  callError,
  callImageUrl,
  callModalOpen,
  callShareToX,
  callouts,
  calloutsLoading,
  calloutsPage,
  calloutsPageSize,
  fetchCallouts,
  formatViews,
  goToBuyFromCall,
  handlePostCallout,
  hasSufficientHoldingForComment,
  isPostingCall,
  isShareModalOpen,
  isThreadModalOpen,
  onReplyPosted,
  openCallModal,
  openShareModal,
  openThreadModal,
  paginatedCallouts,
  toggleLike,
  userHoldingTokensCount,
  userHoldingUsd,
} = tradeCallouts;

// The connected wallet's position in this token, so a sold one can still be shared (a held one
// shows in the swap panel's holdings card). Reloaded when the holdings change after a swap.
const { share: myPosition, load: reloadMyPosition } = usePnlShare(
  computed(() => account.value || undefined),
  computed(() => currentToken.value.address || undefined),
);
const closedPosition = computed(() =>
  myPosition.value?.pnl.status === 'sold' ? myPosition.value : null,
);
watch(userHoldingTokensCount, () => reloadMyPosition());

// SEO: name the page after the token once its metadata has loaded, and keep thin pages out of
// search the way the edge worker does (isIndexableToken).
watch(
  () =>
    [
      currentToken.value.name,
      currentToken.value.symbol,
      currentToken.value.address,
      currentMarketData.value.volume24hUsd,
      currentMarketData.value.isGraduated,
    ] as const,
  ([name, symbol, address, volume24hUsd, isGraduated]) => {
    if (!name || !symbol) return;
    setPageSeo(`/token/${address}`, {
      title: `${name} ($${symbol})`,
      description: tokenSeoDescription(
        name,
        symbol,
        seoChainName(tokenNetwork.value.chainId),
        currentToken.value.description,
      ),
      noindex: !isIndexableToken({
        description: currentToken.value.description,
        volume24hUsd,
        isGraduated,
      }),
    });
  },
  { immediate: true },
);

async function loadTokenData(address: `0x${string}`) {
  tokenLoading.value = true;
  tokenNotFound.value = false;

  const data = await fetchTradeToken(address);
  if (data) {
    currentToken.value = data.token;
    currentMarketData.value = data.marketData;
  } else {
    tokenNotFound.value = true;
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

/** The token and its market data again, keeping the page as it is (after a swap). */
async function refreshTokenData(address: `0x${string}`) {
  const data = await fetchTradeToken(address);
  if (data && address === currentToken.value.address) {
    currentToken.value = data.token;
    currentMarketData.value = data.marketData;
  }
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
        refreshLiveDividends(),
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
        refreshLiveDividends(),
        fetchCallouts(currentToken.value.address),
      ]);
    } else if (!newAcc) {
      userTokenBalance.value = 0n;
      unclaimedDividend.value = null;
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
      refreshLiveDividends(),
    ]);
  }

  tradeMarket.startLive();
});

onUnmounted(() => {
  tradeMarket.stopLive();
});
</script>
