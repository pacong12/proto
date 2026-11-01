import { getSessionHeaders } from '@/lib/session';
import { ref, computed, watch } from 'vue';
import { apiFetch } from '@/lib/api-client';
import { useWallet } from '@/composables/useWallet';
import { useFeed } from '@/composables/useFeed';
import { toast } from '@/components/ui/sonner';
import { formatMarketCap } from '@/lib/utils';
import {
  FALLBACK_ETH_PRICE_USD,
  type TokenCommentEntity,
  type FeedCalloutItem,
} from '@goton/shared-types';
import type { TradePage } from './types';
import type { UseTradeMarket } from './useTradeMarket';
import type { UseTradeForm } from './useTradeForm';

/** Callouts and comments of the token, posting a call, and the share/thread modals. */
export function useTradeCallouts(
  page: TradePage,
  tradeMarket: UseTradeMarket,
  tradeForm: UseTradeForm,
) {
  const { activeBottomTab, currentMarketData, currentToken, isCreator } = page;
  const { quoteAssetPriceUsd } = tradeMarket;
  const { amountIn, getVirtualReserves, payInUsd, scrollToSwap, tradeTab, userTokenBalance } =
    tradeForm;
  const { account, openWallet } = useWallet();

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
      const ethUsd = quoteAssetPriceUsd.value || FALLBACK_ETH_PRICE_USD;
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
            `I just called $${currentToken.value.symbol} at ${formatMarketCap(currentMarketData.value.marketCapUsd)} MC (Target: ${callTargetMcap.value}) on @gotondotfun!\n\n"${content.slice(0, 100)}"\n\n${window.location.href}`,
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
        headers: {
          'Content-Type': 'application/json',
          ...(await getSessionHeaders(account.value)),
        },
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

  return {
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
  };
}

export type UseTradeCallouts = ReturnType<typeof useTradeCallouts>;
