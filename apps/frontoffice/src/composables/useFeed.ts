import { ref, computed } from 'vue';
import type { FeedCalloutItem } from '@proto/shared-types';
import { apiFetch } from '@/lib/api-client';

export type FeedFilterType = 'all' | 'target' | 'profit' | 'media';

export function useFeed() {
  const callouts = ref<FeedCalloutItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeFilter = ref<FeedFilterType>('all');
  const searchQuery = ref('');
  const currentPage = ref(1);
  const pageSize = 10;

  async function fetchFeed(viewerAddress?: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const viewerParam = viewerAddress ? `?viewer=${viewerAddress}` : '';
      const res = await apiFetch<FeedCalloutItem[] | { success: boolean; data: FeedCalloutItem[] }>(
        `/api/feed${viewerParam}`,
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

  async function postCallout(params: {
    tokenAddress: string;
    authorAddress: string;
    content: string;
    imageUrl?: string;
    targetMcap?: string;
    positionUsd?: number;
    profitUsd?: number;
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
            callType: 'call',
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

  const filteredCallouts = computed<FeedCalloutItem[]>(() => {
    let list = callouts.value;

    if (activeFilter.value === 'target') {
      list = list.filter((c) => Boolean(c.targetMcap));
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
  };
}
