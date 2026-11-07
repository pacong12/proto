import { computed, onScopeDispose, ref, watch, type ComputedRef } from 'vue';
import {
  nativeWeiPerQuoteUnit,
  protoV4PoolKeyFor,
  readV4PoolState,
  v4PoolId,
} from '@goton/shared-types';
import { getChainAdapter } from '@/chains';
import { useWallet } from '@/composables/useWallet';
import { poolOutputFromLiquidity, poolSwapImpact } from '@/lib/pool-preview';
import { getPublicClient } from '@/lib/viem-client';
import type { TradePage } from './types';

const QUOTE_DEBOUNCE_MS = 350;

export interface PoolQuoteRequest {
  isBuy: boolean;
  /** Native 18-dp units on a buy, the token's on a sell. */
  amountInWei: bigint;
  taxBps: number;
}

/**
 * The "You receive" figure of a pool swap and the price impact it shows against the pool's live
 * price. It is the router's simulation from the connected wallet; when that cannot run (no wallet,
 * too little balance, a sell not approved yet) it is worked out from the pool's live liquidity.
 * Both null while loading or when the pool cannot be read: the form then shows spot less tax and
 * fee, and no impact it could not measure.
 */
export function usePoolSwapQuote(
  page: Pick<TradePage, 'currentToken' | 'currentMarketData' | 'tokenNetwork'>,
  request: ComputedRef<PoolQuoteRequest | null>,
) {
  const { account } = useWallet();
  const amountOut = ref<bigint | null>(null);
  const priceImpact = ref<number | null>(null);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = 0;

  async function load(id: number, wanted: PoolQuoteRequest, from: `0x${string}` | null) {
    const network = page.tokenNetwork.value;
    const token = page.currentToken.value.address;
    const client = getPublicClient(network.chainId);
    const key = protoV4PoolKeyFor(network, token);
    const poolManager = network.contracts.poolManagerV4;
    // Not quotable or readable right now: each comes back null and the form falls back.
    const [simulated, pool] = await Promise.all([
      from
        ? getChainAdapter(network.chainId)
            .quotePoolSwap(
              { tokenAddress: token, isBuy: wanted.isBuy, amountInWei: wanted.amountInWei },
              client,
              from,
            )
            .catch(() => null)
        : null,
      key && poolManager
        ? readV4PoolState(client, poolManager, v4PoolId(key)).catch(() => null)
        : null,
    ]);
    if (id !== latest) return;
    const swap = {
      isBuy: wanted.isBuy,
      amountInRaw: wanted.isBuy
        ? wanted.amountInWei / nativeWeiPerQuoteUnit(network)
        : wanted.amountInWei,
      quoteIsCurrency0: key ? BigInt(key.currency0) !== BigInt(token) : false,
      taxBps: wanted.taxBps,
    };
    const out = simulated ?? (pool ? poolOutputFromLiquidity({ ...swap, ...pool }) : null);
    if (out === null) return;
    amountOut.value = out;
    if (pool) {
      priceImpact.value = poolSwapImpact({
        ...swap,
        amountOutRaw: out,
        sqrtPriceX96: pool.sqrtPriceX96,
      });
    }
  }

  const quoteInputs = computed(() => {
    const r = request.value;
    if (!r || r.amountInWei <= 0n) return null;
    return [
      page.currentToken.value.address,
      account.value ?? '',
      r.isBuy,
      r.amountInWei,
      r.taxBps,
    ].join(':');
  });

  // New trades move the price, so they re-quote too, keeping the last figure until the new one is in.
  watch(
    [quoteInputs, () => page.currentMarketData.value.priceInWeth],
    ([inputs], [previousInputs]) => {
      const id = ++latest;
      clearTimeout(timer);
      if (inputs !== previousInputs) {
        amountOut.value = null;
        priceImpact.value = null;
      }
      const wanted = request.value;
      const from = (account.value as `0x${string}` | null | undefined) ?? null;
      if (!inputs || !wanted) return;
      timer = setTimeout(() => void load(id, wanted, from), QUOTE_DEBOUNCE_MS);
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    latest++;
    clearTimeout(timer);
  });

  return { amountOut, priceImpact };
}
