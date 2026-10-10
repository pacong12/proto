/**
 * Shared reactive token store.
 *
 * A module-level singleton so that ExploreView, SearchDialog, FeedView,
 * and any other consumer share one fetch and centralized GMGN-style chain segmentation
 * instead of duplicating network filter checks across multiple pages.
 */
import { ref, readonly, computed, watch } from 'vue';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';
import {
  isArcToken,
  ARC_NETWORK,
  ROBINHOOD_NETWORK,
  ARC_CHAIN,
  ROBINHOOD_CHAIN,
  type NetworkConfig,
} from '@proto/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useWallet } from './useWallet';

export interface TokenListItem {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData | null;
}

export type ChainViewMode = 'all' | 'robinhood' | 'arc';

// Module-level singletons - shared across all composable consumers
const tokens = ref<TokenListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
let lastFetched = 0;
const STALE_MS = 15_000; // re-fetch if data is older than 15 seconds

const selectedChainView = ref<ChainViewMode>('robinhood');

export function useTokenStore() {
  const { activeNetwork, switchOrAddNetwork } = useWallet();

  // Keep selectedChainView synchronized with active wallet network by default
  watch(
    activeNetwork,
    (net) => {
      if (selectedChainView.value !== 'all') {
        selectedChainView.value = net.chainId === ARC_NETWORK.chainId ? 'arc' : 'robinhood';
      }
    },
    { immediate: true },
  );

  async function fetchTokens(force = false): Promise<void> {
    const now = Date.now();
    if (!force && tokens.value.length > 0 && now - lastFetched < STALE_MS) {
      return; // still fresh
    }
    if (loading.value) return; // de-duplicate concurrent calls

    loading.value = true;
    error.value = null;
    try {
      const res = await apiFetch<TokenListItem[] | { success: boolean; data: TokenListItem[] }>(
        '/api/tokens?limit=200&offset=0',
      );
      if (Array.isArray(res)) {
        tokens.value = res;
      } else if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) {
        tokens.value = res.data;
      } else {
        tokens.value = [];
      }
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

  /**
   * All Robinhood Chain tokens.
   */
  const robinhoodTokens = computed<TokenListItem[]>(() => {
    return tokens.value.filter((item) => !isArcToken(item.token));
  });

  /**
   * All Arc Network tokens.
   */
  const arcTokens = computed<TokenListItem[]>(() => {
    return tokens.value.filter((item) => isArcToken(item.token));
  });

  /**
   * Tokens for the currently active chain (wallet-linked).
   */
  const networkTokens = computed<TokenListItem[]>(() => {
    const isArc = activeNetwork.value.chainId === ARC_NETWORK.chainId;
    return isArc ? arcTokens.value : robinhoodTokens.value;
  });

  /**
   * Tokens matching current GMGN-style selected chain view ('all' | 'robinhood' | 'arc').
   */
  const chainTokens = computed<TokenListItem[]>(() => {
    if (selectedChainView.value === 'arc') return arcTokens.value;
    if (selectedChainView.value === 'robinhood') return robinhoodTokens.value;
    return tokens.value;
  });

  /**
   * Set of lowercase contract addresses for tokens on the active network.
   */
  const networkTokenAddresses = computed<Set<string>>(() => {
    return new Set(networkTokens.value.map((t) => t.token.address.toLowerCase()));
  });

  /**
   * Set of lowercase contract addresses for tokens on the selected chain view.
   */
  const chainTokenAddresses = computed<Set<string>>(() => {
    return new Set(chainTokens.value.map((t) => t.token.address.toLowerCase()));
  });

  /**
   * Resolves the network config for any token entity or contract address.
   */
  function getTokenNetwork(
    tokenOrAddress: string | LaunchedTokenEntity | null | undefined,
  ): NetworkConfig {
    if (!tokenOrAddress) return ROBINHOOD_NETWORK;
    if (typeof tokenOrAddress === 'string') {
      const match = tokens.value.find(
        (t) => t.token.address.toLowerCase() === tokenOrAddress.toLowerCase(),
      );
      if (match) return isArcToken(match.token) ? ARC_NETWORK : ROBINHOOD_NETWORK;
      return ROBINHOOD_NETWORK;
    }
    return isArcToken(tokenOrAddress) ? ARC_NETWORK : ROBINHOOD_NETWORK;
  }

  /**
   * Returns true if a given token or contract address belongs to the currently active chain.
   */
  function isTokenOnActiveNetwork(tokenOrAddress: string | LaunchedTokenEntity): boolean {
    if (typeof tokenOrAddress === 'string') {
      return networkTokenAddresses.value.has(tokenOrAddress.toLowerCase());
    }
    return isArcToken(tokenOrAddress) === (activeNetwork.value.chainId === ARC_NETWORK.chainId);
  }

  /**
   * Switch the current GMGN chain view mode, optionally switching wallet network.
   */
  async function selectChainView(mode: ChainViewMode, syncWallet = true): Promise<void> {
    selectedChainView.value = mode;
    if (syncWallet) {
      if (mode === 'arc') {
        await switchOrAddNetwork(ARC_CHAIN);
      } else if (mode === 'robinhood') {
        await switchOrAddNetwork(ROBINHOOD_CHAIN);
      }
    }
  }

  return {
    tokens: readonly(tokens),
    robinhoodTokens,
    arcTokens,
    networkTokens,
    chainTokens,
    networkTokenAddresses,
    chainTokenAddresses,
    selectedChainView,
    selectChainView,
    getTokenNetwork,
    isTokenOnActiveNetwork,
    loading: readonly(loading),
    error: readonly(error),
    fetchTokens,
    invalidate,
  };
}
