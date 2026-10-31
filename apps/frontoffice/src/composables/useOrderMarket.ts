import { ref, watch, type Ref } from 'vue';
import {
  bondingCurveAbi,
  protoV4PoolKeyFor,
  readV4PoolState,
  stopLossOracleStatus,
  v4PoolId,
  type LaunchedTokenEntity,
  type NetworkConfig,
  type StopOracleStatus,
  type TokenMarketData,
} from '@goton/shared-types';
import { getPublicClient } from '@/lib/viem-client';

/**
 * What the order form needs from the token's market beyond its price: the constant-product
 * invariant its sells move along (curve reserves, or the v4 pool's in-range liquidity squared, in
 * raw units), for price impact, and whether its stop-losses can fire yet. Refreshed with the price.
 */
export function useOrderMarket(
  network: Ref<NetworkConfig>,
  token: Ref<LaunchedTokenEntity>,
  marketData: Ref<TokenMarketData>,
) {
  const invariant = ref<number | null>(null);
  const stopOracle = ref<StopOracleStatus | null>(null);

  async function load(): Promise<void> {
    const net = network.value;
    const t = token.value;
    if (!t.address) return;
    const client = getPublicClient(net.chainId);
    const onCurve = !marketData.value.isGraduated && !t.isGraduated && t.curveAddress;
    const [k, oracle] = await Promise.allSettled([
      onCurve
        ? Promise.all([
            client.readContract({
              address: t.curveAddress!,
              abi: bondingCurveAbi,
              functionName: 'virtualEthReserve',
            }),
            client.readContract({
              address: t.curveAddress!,
              abi: bondingCurveAbi,
              functionName: 'virtualTokenReserve',
            }),
          ]).then(([eth, tokens]) => Number(eth) * Number(tokens))
        : (async () => {
            const key = protoV4PoolKeyFor(net, t.address);
            if (!key || !net.contracts.poolManagerV4) return null;
            const { liquidity } = await readV4PoolState(
              client,
              net.contracts.poolManagerV4,
              v4PoolId(key),
            );
            return Number(liquidity) ** 2;
          })(),
      stopLossOracleStatus(client, net, {
        address: t.address,
        curveAddress: t.curveAddress,
        isGraduated: marketData.value.isGraduated || t.isGraduated,
      }),
    ]);
    invariant.value = k.status === 'fulfilled' && k.value ? k.value : null;
    stopOracle.value = oracle.status === 'fulfilled' ? oracle.value : null;
  }

  watch(
    () => [token.value.address, marketData.value.priceInWeth, marketData.value.isGraduated],
    () => void load(),
    { immediate: true },
  );
  return { invariant, stopOracle };
}
