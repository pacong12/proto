import { computed, onScopeDispose, ref, watch, type ComputedRef } from 'vue';
import {
  nativeWeiPerQuoteUnit,
  protoV4PoolKeyFor,
  readV4PoolState,
  v4PoolId,
} from '@goton/shared-types';
import { getChainAdapter } from '@/chains';
import { useWallet } from '@/composables/useWallet';
import { poolSwapImpact } from '@/lib/pool-preview';
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
 * The "You receive" figure of a pool swap: the router's simulation from the connected wallet, and
 * the price impact it shows against the pool's live price. Both null while loading or when it cannot
 * simulate (no wallet, too little balance, a sell not approved yet): the form then shows spot less
 * tax and fee, and no impact it could not measure.
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

  async function load(id: number, wanted: PoolQuoteRequest, from: `0x${string}`) {
    const network = page.tokenNetwork.value;
    const token = page.currentToken.value.address;
    const client = getPublicClient(network.chainId);
    try {
      const out = await getChainAdapter(network.chainId).quotePoolSwap(
        { tokenAddress: token, isBuy: wanted.isBuy, amountInWei: wanted.amountInWei },
        client,
        from,
      );
      if (id !== latest) return;
      amountOut.value = out;
      const key = protoV4PoolKeyFor(network, token);
      if (!key || !network.contracts.poolManagerV4) return;
      const { sqrtPriceX96 } = await readV4PoolState(
        client,
        network.contracts.poolManagerV4,
        v4PoolId(key),
      );
      if (id !== latest) return;
      priceImpact.value = poolSwapImpact({
        isBuy: wanted.isBuy,
        amountInRaw: wanted.isBuy
          ? wanted.amountInWei / nativeWeiPerQuoteUnit(network)
          : wanted.amountInWei,
        amountOutRaw: out,
        sqrtPriceX96,
        quoteIsCurrency0: BigInt(key.currency0) !== BigInt(token),
        taxBps: wanted.taxBps,
      });
    } catch {
      // Not quotable right now: the form falls back on its estimate.
    }
  }

  const quoteInputs = computed(() => {
    const r = request.value;
    if (!r || !account.value || r.amountInWei <= 0n) return null;
    return [page.currentToken.value.address, account.value, r.isBuy, r.amountInWei, r.taxBps].join(
      ':',
    );
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
      const from = account.value as `0x${string}` | null | undefined;
      if (!inputs || !wanted || !from) return;
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
