/**
 * Shared reactive token store.
 *
 * A module-level singleton so that ExploreView, SearchDialog, FeedView,
 * and any other consumer share one fetch and centralized GMGN-style chain segmentation
 * instead of duplicating network filter checks across multiple pages.
 */
import { ref, readonly, computed, watch } from 'vue';
import type { LaunchedTokenEntity, TokenMarketData } from '@goton/shared-types';
import {
  resolveTokenNetwork,
  resolveNetworkByParam,
  DEFAULT_NETWORK,
  type NetworkConfig,
} from '@goton/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useWallet } from './useWallet';

export interface TokenListItem {
  token: LaunchedTokenEntity;
  marketData: TokenMarketData | null;
}

/** 'all', or a chain slug from the registry. */
export type ChainViewMode = 'all' | (string & {});

// Module-level singletons - shared across all composable consumers
const tokens = ref<TokenListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
let lastFetched = 0;
const STALE_MS = 15_000; // re-fetch if data is older than 15 seconds

const selectedChainView = ref<ChainViewMode>(DEFAULT_NETWORK.slug);

export function useTokenStore() {
  const { activeNetwork, switchOrAddNetwork } = useWallet();

  // Keep selectedChainView synchronized with active wallet network by default
  watch(
    activeNetwork,
    (net) => {
      if (selectedChainView.value !== 'all') {
        selectedChainView.value = net.slug;
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
   * Tokens for the currently active chain (wallet-linked).
   */
  const networkTokens = computed<TokenListItem[]>(() => {
    return tokens.value.filter(
      (item) => getTokenNetwork(item.token).chainId === activeNetwork.value.chainId,
    );
  });

  /**
   * Tokens matching current GMGN-style selected chain view ('all' | chain param).
   * Scalable: dynamically resolves target chain via resolveNetworkByParam.
   */
  const chainTokens = computed<TokenListItem[]>(() => {
    if (selectedChainView.value === 'all') return tokens.value;
    const targetNet = resolveNetworkByParam(selectedChainView.value);
    return tokens.value.filter((item) => getTokenNetwork(item.token).chainId === targetNet.chainId);
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
    if (!tokenOrAddress) return activeNetwork.value;
    if (typeof tokenOrAddress === 'string') {
      const match = tokens.value.find(
        (t) => t.token.address.toLowerCase() === tokenOrAddress.toLowerCase(),
      );
      if (match) return resolveTokenNetwork(match.token);
      return resolveTokenNetwork({ pairedToken: tokenOrAddress, poolAddress: tokenOrAddress });
    }
    return resolveTokenNetwork(tokenOrAddress);
  }

  /**
   * Returns true if a given token or contract address belongs to the currently active chain.
   */
  function isTokenOnActiveNetwork(tokenOrAddress: string | LaunchedTokenEntity): boolean {
    if (typeof tokenOrAddress === 'string') {
      return networkTokenAddresses.value.has(tokenOrAddress.toLowerCase());
    }
    return getTokenNetwork(tokenOrAddress).chainId === activeNetwork.value.chainId;
  }

  /**
   * Switch the current GMGN chain view mode, optionally switching wallet network.
   */
  async function selectChainView(mode: ChainViewMode, syncWallet = true): Promise<void> {
    selectedChainView.value = mode;
    if (syncWallet && mode !== 'all') {
      const net = resolveNetworkByParam(mode);
      await switchOrAddNetwork(net);
    }
  }

  return {
    tokens: readonly(tokens),
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
