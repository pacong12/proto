import { computed, ref, watch, type Ref } from 'vue';
import { resolveFeeSplitter, supportsFeeSplitters, type NetworkConfig } from '@goton/shared-types';
import { getPublicClient } from '@/lib/viem-client';
import { isRedirected, readSplitterRedirectState, type RedirectState } from '@/lib/cto-redirect';

/**
 * Whether a token's creator share is redirected to a community (community takeover), read once
 * per token page from its fee splitter. Failures leave the badge hidden.
 */
export function useCommunityRedirect(
  tokenAddress: Ref<string | undefined>,
  network: Ref<NetworkConfig>,
) {
  const state = ref<RedirectState | null>(null);
  let requestId = 0;

  async function load(token: string | undefined, net: NetworkConfig) {
    const id = ++requestId;
    state.value = null;
    if (!token || !supportsFeeSplitters(net)) return;
    try {
      const client = getPublicClient(net.chainId);
      const splitter = await resolveFeeSplitter(client, net, token as `0x${string}`);
      if (!splitter) return;
      const next = await readSplitterRedirectState(client, splitter.address);
      if (id === requestId) state.value = next;
    } catch {
      // Non-blocking: no badge
    }
  }

  watch(
    () => [tokenAddress.value?.toLowerCase(), network.value.chainId] as const,
    () => void load(tokenAddress.value, network.value),
    { immediate: true },
  );

  const isCommunity = computed(() => (state.value ? isRedirected(state.value) : false));
  const isLocked = computed(() => Boolean(state.value?.locked));
  const recipient = computed(() => state.value?.recipient ?? null);

  return { state, isCommunity, isLocked, recipient };
}
