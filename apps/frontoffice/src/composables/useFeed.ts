import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { type FeedCalloutItem, buildCommentSignMessage } from '@proto/shared-types';
import { getSessionHeaders } from '../lib/session';
import { apiFetch } from '@/lib/api-client';
import { getWalletClient } from '@/lib/viem-client';

export type FeedFilterType = 'all' | 'target' | 'whale' | 'profit' | 'media';

/**
 * Global crypto/launchpad whale rule:
 * Caller holds >= 1.0% of total token supply OR holds a position >= $500 USD.
 */
export function isWhaleCaller(call: { positionUsd?: number; supplyPercent?: number }): boolean {
  return (call.supplyPercent ?? 0) >= 1.0 || (call.positionUsd ?? 0) >= 500;
}

export function useFeed(): {
  callouts: Ref<FeedCalloutItem[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  activeFilter: Ref<FeedFilterType>;
  searchQuery: Ref<string>;
  currentPage: Ref<number>;
  pageSize: number;
  filteredCallouts: ComputedRef<FeedCalloutItem[]>;
  paginatedCallouts: ComputedRef<FeedCalloutItem[]>;
  fetchFeed: (viewerAddress?: string, authorAddress?: string) => Promise<void>;
  fetchUserPosts: (userAddress: string, viewerAddress?: string) => Promise<FeedCalloutItem[]>;
  postCallout: (params: {
    tokenAddress: string;
    authorAddress: string;
    content: string;
    imageUrl?: string;
    targetMcap?: string;
    positionUsd?: number;
    profitUsd?: number;
    parentId?: string;
    quotedCalloutId?: string;
    callType?: 'call' | 'comment';
  }) => Promise<FeedCalloutItem | null>;
  toggleLike: (
    commentId: string,
    userAddress: string,
  ) => Promise<{ liked: boolean; likesCount: number } | null>;
  toggleRepost: (
    commentId: string,
    userAddress: string,
  ) => Promise<{ reposted: boolean; repostsCount: number } | null>;
  recordView: (commentId: string) => Promise<number | null>;
  fetchCalloutThread: (
    calloutId: string,
    viewerAddress?: string,
  ) => Promise<FeedCalloutItem | null>;
  fetchCallerBalance: (tokenAddress: string, accountAddress: string) => Promise<number>;
} {
  const callouts = ref<FeedCalloutItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeFilter = ref<FeedFilterType>('all');
  const searchQuery = ref('');
  const currentPage = ref(1);
  const pageSize = 10;

  async function fetchFeed(viewerAddress?: string, authorAddress?: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      if (viewerAddress) params.set('viewer', viewerAddress);
      if (authorAddress) params.set('author', authorAddress);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<FeedCalloutItem[] | { success: boolean; data: FeedCalloutItem[] }>(
        `/api/feed${query}`,
      );

      if (Array.isArray(res)) {
        callouts.value = res;
      } else if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) {
        callouts.value = res.data;
      } else {
        callouts.value = [];
      }
    } catch (err) {
      error.value = (err as Error).message || 'Failed to fetch feed';
      callouts.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchUserPosts(
    userAddress: string,
    viewerAddress?: string,
  ): Promise<FeedCalloutItem[]> {
    try {
      const params = new URLSearchParams();
      if (viewerAddress) params.set('viewer', viewerAddress);
      params.set('author', userAddress);
      const res = await apiFetch<FeedCalloutItem[] | { success: boolean; data: FeedCalloutItem[] }>(
        `/api/feed?${params.toString()}`,
      );
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data))
        return res.data;
      return [];
    } catch (e) {
      console.warn('[useFeed] fetchUserPosts failed:', (e as Error).message);
      return [];
    }
  }

  async function postCallout(params: {
    tokenAddress: string;
    authorAddress: string;
    content: string;
    imageUrl?: string;
    targetMcap?: string;
    positionUsd?: number;
    profitUsd?: number;
    parentId?: string;
    quotedCalloutId?: string;
    callType?: 'call' | 'comment';
  }): Promise<FeedCalloutItem | null> {
    try {
      let signature: `0x${string}` | undefined;
      const timestamp = Date.now();

      const walletClient = await getWalletClient();
      if (walletClient) {
        try {
          const message = buildCommentSignMessage({
            tokenAddress: params.tokenAddress,
            authorAddress: params.authorAddress,
            content: params.content,
            timestamp,
          });
          signature = await walletClient.signMessage({
            account: params.authorAddress as `0x${string}`,
            message,
          });
        } catch (signErr) {
          const msg = ((signErr as Error)?.message ?? '').toLowerCase();
          if (
            msg.includes('user reject') ||
            msg.includes('user denied') ||
            msg.includes('user cancelled') ||
            msg.includes('user canceled') ||
            msg.includes('action_rejected')
          ) {
            return null;
          }
          throw signErr;
        }
      }

      const res = await apiFetch<{ success: boolean; data: FeedCalloutItem }>(
        `/api/tokens/${params.tokenAddress}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorAddress: params.authorAddress,
            content: params.content,
            imageUrl: params.imageUrl,
            targetMcap: params.targetMcap,
            positionUsd: params.positionUsd,
            profitUsd: params.profitUsd,
            parentId: params.parentId,
            quotedCalloutId: params.quotedCalloutId,
            callType: params.callType ?? (params.parentId ? 'comment' : 'call'),
            signature,
            timestamp,
          }),
        },
      );
      if (res && typeof res === 'object' && 'data' in res) {
        return res.data;
      }
      return null;
    } catch (err) {
      throw new Error((err as Error).message || 'Failed to post callout');
    }
  }

  async function toggleLike(
    commentId: string,
    userAddress: string,
  ): Promise<{ liked: boolean; likesCount: number } | null> {
    try {
      const res = await apiFetch<{
        success: boolean;
        data: { liked: boolean; likesCount: number };
      }>(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(userAddress)) },
        body: JSON.stringify({ userAddress }),
      });

      if (res && typeof res === 'object' && 'data' in res) {
        const item = callouts.value.find((c) => c.id === commentId);
        if (item) {
          item.likesCount = res.data.likesCount;
          item.isLikedByViewer = res.data.liked;
        }
        return res.data;
      }
      return null;
    } catch (e) {
      console.warn('[useFeed] toggleLike failed:', (e as Error).message);
      return null;
    }
  }

  async function toggleRepost(
    commentId: string,
    userAddress: string,
  ): Promise<{ reposted: boolean; repostsCount: number } | null> {
    try {
      const res = await apiFetch<{
        success: boolean;
        data: { reposted: boolean; repostsCount: number };
      }>(`/api/comments/${commentId}/repost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSessionHeaders(userAddress)) },
        body: JSON.stringify({ userAddress }),
      });

      if (res && typeof res === 'object' && 'data' in res) {
        const item = callouts.value.find((c) => c.id === commentId);
        if (item) {
          item.repostsCount = res.data.repostsCount;
          item.isRepostedByViewer = res.data.reposted;
        }
        return res.data;
      }
      return null;
    } catch (e) {
      console.warn('[useFeed] toggleRepost failed:', (e as Error).message);
      return null;
    }
  }

  async function fetchCalloutThread(
    calloutId: string,
    viewerAddress?: string,
  ): Promise<FeedCalloutItem | null> {
    try {
      const viewerParam = viewerAddress ? `?viewer=${viewerAddress}` : '';
      const res = await apiFetch<{ success: boolean; data: FeedCalloutItem }>(
        `/api/callouts/${calloutId}${viewerParam}`,
      );
      if (res && typeof res === 'object' && 'data' in res) {
        return res.data;
      }
      return null;
    } catch (e) {
      console.warn('[useFeed] fetchCalloutThread failed:', (e as Error).message);
      return null;
    }
  }

  async function recordView(commentId: string): Promise<number | null> {
    try {
      const res = await apiFetch<{
        success: boolean;
        data: { viewsCount: number };
      }>(`/api/comments/${commentId}/view`, {
        method: 'POST',
      });
      if (res && typeof res === 'object' && 'data' in res) {
        const item = callouts.value.find((c) => c.id === commentId);
        if (item) {
          item.viewsCount = res.data.viewsCount;
        }
        return res.data.viewsCount;
      }
      return null;
    } catch (e) {
      console.warn('[useFeed] recordView failed:', (e as Error).message);
      return null;
    }
  }

  /**
   * Fetch the token balance of a caller account for a given token.
   * Used by FeedView to gate callout posting (skin-in-the-game check).
   * Returns 0 on any error so the caller can safely default to no-position.
   */
  async function fetchCallerBalance(tokenAddress: string, accountAddress: string): Promise<number> {
    try {
      const res = await apiFetch<{ success: boolean; data: { balance: string | number } }>(
        `/api/tokens/${tokenAddress}/balance?account=${accountAddress}`,
      );
      if (res?.success && res.data) {
        return Number(res.data.balance || 0);
      }
      return 0;
    } catch (e) {
      console.warn('[useFeed] fetchCallerBalance failed:', (e as Error).message);
      return 0;
    }
  }

  const filteredCallouts = computed<FeedCalloutItem[]>(() => {
    let list = callouts.value;

    if (activeFilter.value === 'target') {
      list = list.filter((c) => Boolean(c.targetMcap));
    } else if (activeFilter.value === 'whale') {
      list = list.filter((c) => isWhaleCaller(c));
    } else if (activeFilter.value === 'profit') {
      list = list.filter((c) => (c.profitUsd ?? 0) > 0);
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

  const paginatedCallouts = computed<FeedCalloutItem[]>(() => {
    const start = (currentPage.value - 1) * pageSize;
    return filteredCallouts.value.slice(start, start + pageSize);
  });

  return {
    callouts,
    loading,
    error,
    activeFilter,
    searchQuery,
    currentPage,
    pageSize,
    filteredCallouts,
    paginatedCallouts,
    fetchFeed,
    postCallout,
    toggleLike,
    toggleRepost,
    recordView,
    fetchCalloutThread,
    fetchUserPosts,
    fetchCallerBalance,
  };
}
