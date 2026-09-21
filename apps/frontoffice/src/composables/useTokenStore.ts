/**
 * Shared reactive token store.
 *
 * A module-level singleton so that ExploreView, SearchDialog, and any other
 * consumer share one fetch and one reactive list instead of each issuing their
 * own /api/tokens request on mount.
 */
import { ref, readonly } from 'vue';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';
import { apiFetch } from '@/lib/api-client';

export interface TokenListItem {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData | null;
}

// Module-level singletons — shared across all composable consumers
const tokens = ref<TokenListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
let lastFetched = 0;
const STALE_MS = 15_000; // re-fetch if data is older than 15 seconds

export function useTokenStore() {
  async function fetchTokens(force = false): Promise<void> {
    const now = Date.now();
    if (!force && tokens.value.length > 0 && now - lastFetched < STALE_MS) {
      return; // still fresh
    }
    if (loading.value) return; // de-duplicate concurrent calls

    loading.value = true;
    error.value = null;
    try {
      const data = await apiFetch<TokenListItem[]>('/api/tokens?limit=200&offset=0');
      tokens.value = Array.isArray(data) ? data : [];
      lastFetched = Date.now();
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  function invalidate(): void {
    lastFetched = 0;
  }

  return {
    tokens: readonly(tokens),
    loading: readonly(loading),
    error: readonly(error),
    fetchTokens,
    invalidate,
  };
}
