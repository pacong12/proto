import { ref, computed } from 'vue';
import type { FeedCalloutItem } from '@proto/shared-types';
import { apiFetch } from '@/lib/api-client';

export type FeedFilterType = 'all' | 'target' | 'whale' | 'profit' | 'media';

/**
 * Global crypto/launchpad whale rule:
 * Caller holds >= 1.0% of total token supply OR holds a position >= $500 USD.
 */
export function isWhaleCaller(call: { positionUsd?: number; supplyPercent?: number }): boolean {
  return (call.supplyPercent ?? 0) >= 1.0 || (call.positionUsd ?? 0) >= 500;
}

export function useFeed() {
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

  async function fetchUserPosts(userAddress: string, viewerAddress?: string): Promise<FeedCalloutItem[]> {
    try {
      const params = new URLSearchParams();
      if (viewerAddress) params.set('viewer', viewerAddress);
      params.set('author', userAddress);
      const res = await apiFetch<FeedCalloutItem[] | { success: boolean; data: FeedCalloutItem[] }>(
        `/api/feed?${params.toString()}`,
      );
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) return res.data;
      return [];
    } catch {
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
  }): Promise<FeedCalloutItem | null> {
    try {
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
            callType: params.parentId ? 'comment' : 'call',
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
        headers: { 'Content-Type': 'application/json' },
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
    } catch {
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
        headers: { 'Content-Type': 'application/json' },
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
    } catch {
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
    } catch {
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
    } catch {
      return null;
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
  };
}
