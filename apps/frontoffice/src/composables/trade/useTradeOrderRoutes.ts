import { ref, computed, watch } from 'vue';
import { limitOrdersAddress } from '@/composables/useLimitOrders';
import { getPublicClient } from '@/lib/viem-client';
import { launchpadV2FactoryAbi, protoV4PoolKeyFor } from '@goton/shared-types';
import type { TradePage } from './types';

/** Whether limit, take-profit and stop-loss orders are available for this token. */
export function useTradeOrderRoutes(page: TradePage) {
  const { currentToken, tokenNetwork } = page;

  // Limit / TP-SL orders appear only where GotonLimitOrders is deployed.
  const ORDER_TYPES = [
    { value: 'market', label: 'orderTypeMarket' },
    { value: 'limit', label: 'orderTypeLimit' },
    { value: 'tpsl', label: 'orderTypeTpSl' },
  ] as const;

  const orderType = ref<(typeof ORDER_TYPES)[number]['value']>('market');

  const ordersRefresh = ref(0);

  // Same routes as the keeper: the token's bonding curve, or its Goton v4 pool once one exists.
  // Same routes as the keeper and the contract: a curve of the current factory (curveToToken), or
  // the token's Goton v4 pool. Curves of older factories are refused on-chain, so orders on them
  // could never fill.
  const curveRegistered = ref(false);

  watch(
    () => [currentToken.value.address, currentToken.value.curveAddress, tokenNetwork.value.chainId],
    async () => {
      curveRegistered.value = false;
      const t = currentToken.value;
      const factory =
        tokenNetwork.value.contracts.factoryV2 ?? tokenNetwork.value.contracts.factory;
      if (!t.curveAddress || !factory || limitOrdersAddress(tokenNetwork.value) === null) return;
      try {
        const owner = await getPublicClient(tokenNetwork.value.chainId).readContract({
          address: factory,
          abi: launchpadV2FactoryAbi,
          functionName: 'curveToToken',
          args: [t.curveAddress as `0x${string}`],
        });
        if (t.address === currentToken.value.address) {
          curveRegistered.value = owner.toLowerCase() === t.address.toLowerCase();
        }
      } catch {
        // Factory without curves (Arc) or RPC error: no curve route.
      }
    },
    { immediate: true },
  );

  const limitOrdersEnabled = computed(() => {
    if (limitOrdersAddress(tokenNetwork.value) === null) return false;
    const t = currentToken.value;
    const onCurve = t.version === 'v2' && !t.isGraduated && !!t.curveAddress;
    if (onCurve) return curveRegistered.value;
    return protoV4PoolKeyFor(tokenNetwork.value, t.address) !== null;
  });

  return {
    ORDER_TYPES,
    limitOrdersEnabled,
    orderType,
    ordersRefresh,
  };
}

export type UseTradeOrderRoutes = ReturnType<typeof useTradeOrderRoutes>;
