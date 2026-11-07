import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  LimitExceededRpcError,
  TimeoutError,
  WebSocketRequestError,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { protoV4PoolKey, gotonV4RouterAbi, type NetworkConfig } from '@goton/shared-types';
import type { ChainSwapParams, V4SwapInput } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { ensureAllowance } from '../../lib/wallet-tx';
import { isDeployed, resolveMinAmountOut, swapGasLimit } from './utils';

export interface V4QuoteConfig {
  /** Pool quote currency: address(0) for native ETH, or an ERC-20 (Arc USDC). */
  quote: `0x${string}`;
  /**
   * Native wei per quote unit when the quote is paid with msg.value: 1 for native ETH,
   * 1e12 for Arc USDC (18-dp native balance behind a 6-dp ERC-20).
   */
  nativeScale: bigint;
}

/** A public RPC can lag the wallet's: how long a just-mined approval gets to reach it. */
const APPROVAL_SYNC_ATTEMPTS = 3;
const APPROVAL_SYNC_DELAY_MS = 1_500;

function routerSwap(
  network: NetworkConfig,
  quote: V4QuoteConfig,
  params: V4SwapInput,
  account: `0x${string}`,
  minOut: bigint,
) {
  const { memeHook, router } = network.contracts;
  if (!isDeployed(memeHook) || !isDeployed(router)) {
    throw new Error(`Uniswap v4 trading is not configured on ${network.name}`);
  }

  const poolKey = protoV4PoolKey(params.tokenAddress, quote.quote, memeHook);
  const zeroForOne =
    params.isBuy === (poolKey.currency0.toLowerCase() === quote.quote.toLowerCase());
  const amountIn = params.isBuy ? params.amountInWei / quote.nativeScale : params.amountInWei;
  return {
    address: router,
    abi: gotonV4RouterAbi,
    functionName: 'swapExactIn',
    args: [
      poolKey,
      zeroForOne,
      amountIn,
      minOut,
      account,
      BigInt(Math.floor(Date.now() / 1000) + 1200),
    ],
    value: params.isBuy ? amountIn * quote.nativeScale : 0n,
    account,
  } as const;
}

/**
 * What this swap pays right now, in the output currency's own units (tokens, or the quote's raw
 * units: 6 dp on Arc): the router's own simulation without a floor, so the hook's tax, the LP fee
 * and price impact are all in it. Throws when the swap would revert; a sell needs its allowance.
 */
export async function quoteV4RouterSwap(
  network: NetworkConfig,
  quote: V4QuoteConfig,
  params: V4SwapInput,
  publicClient: PublicClient,
  account: `0x${string}`,
): Promise<bigint> {
  const { result } = await publicClient.simulateContract(
    routerSwap(network, quote, params, account, 0n),
  );
  return result;
}

/** The RPC did not answer: unlike a revert, that says nothing about the swap itself. */
function isRpcUnavailable(err: unknown): boolean {
  return (
    err instanceof BaseError &&
    Boolean(
      err.walk(
        (e) =>
          e instanceof HttpRequestError ||
          e instanceof WebSocketRequestError ||
          e instanceof TimeoutError ||
          e instanceof LimitExceededRpcError,
      ),
    )
  );
}

function swapWouldFail(err: unknown): Error {
  const reverted =
    err instanceof BaseError ? err.walk((e) => e instanceof ContractFunctionRevertedError) : null;
  const reason =
    reverted instanceof ContractFunctionRevertedError
      ? (reverted.data?.errorName ?? reverted.reason)
      : undefined;
  return new Error(
    `This swap would fail on-chain${reason ? ` (${reason})` : ''}, so it was not sent. ` +
      'Check your balance and the amount, then retry.',
  );
}

/**
 * The swap's floor in the output currency's own units, from its real output. The caller's estimate
 * comes from an indexed price, so it only stands in when the RPC cannot answer; a swap that
 * simulates as a revert is never sent. Never returns 0: that would drop the slippage protection.
 */
async function resolvePoolMinOut(
  network: NetworkConfig,
  quote: V4QuoteConfig,
  params: ChainSwapParams,
  publicClient: PublicClient,
  account: `0x${string}`,
  justApproved: boolean,
): Promise<bigint> {
  const fromNative = (native: bigint) => (params.isBuy ? native : native / quote.nativeScale);
  const { amountOutMinimum, expectedAmountOut, slippagePercent } = params;

  let minOut: bigint;
  if (amountOutMinimum !== undefined && amountOutMinimum > 0n) {
    minOut = fromNative(amountOutMinimum);
  } else {
    let quoted: bigint | undefined;
    for (let attempt = 1; quoted === undefined; attempt++) {
      try {
        quoted = await quoteV4RouterSwap(network, quote, params, publicClient, account);
      } catch (err) {
        if (isRpcUnavailable(err)) break;
        if (!justApproved || attempt >= APPROVAL_SYNC_ATTEMPTS) throw swapWouldFail(err);
        await new Promise((resolve) => setTimeout(resolve, APPROVAL_SYNC_DELAY_MS));
      }
    }
    minOut =
      quoted === undefined
        ? fromNative(resolveMinAmountOut(undefined, expectedAmountOut, slippagePercent))
        : resolveMinAmountOut(undefined, quoted, slippagePercent);
  }
  if (minOut <= 0n) throw new Error('This swap is too small to protect with a minimum output.');
  return minOut;
}

/**
 * Exact-input swap in a Goton Uniswap v4 pool through GotonV4Router.
 * Buys pay the quote with msg.value (no approval). Sells approve exactly the sold amount.
 * `params.amountInWei`, `expectedAmountOut` and `amountOutMinimum` use native 18-dp units for the
 * quote side.
 */
export async function executeV4RouterSwap(
  network: NetworkConfig,
  quote: V4QuoteConfig,
  params: ChainSwapParams,
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: `0x${string}`,
): Promise<`0x${string}`> {
  const { address: router } = routerSwap(network, quote, params, account, 0n);

  // Before the floor: a sell only simulates once the router may pull the tokens.
  const justApproved =
    !params.isBuy &&
    (await ensureAllowance({
      publicClient,
      walletClient,
      account,
      token: params.tokenAddress,
      spender: router,
      amount: params.amountInWei,
      onSubmitted: params.onApproveSubmitted,
    }));

  const swap = routerSwap(
    network,
    quote,
    params,
    account,
    await resolvePoolMinOut(network, quote, params, publicClient, account, justApproved),
  );
  const hash = await walletClient.writeContract({
    ...swap,
    gas: await swapGasLimit(publicClient, swap),
    chain: walletClient.chain,
  });
  params.onSubmitted?.(hash);
  waitForReceiptWithFallback(publicClient, hash, walletClient).catch(() => {});
  return hash;
}
