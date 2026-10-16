import { erc20Abi, type PublicClient, type WalletClient } from 'viem';
import { protoV4PoolKey, gotonV4RouterAbi, type NetworkConfig } from '@goton/shared-types';
import type { ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { isDeployed, resolveMinAmountOut } from './utils';

export interface V4QuoteConfig {
  /** Pool quote currency: address(0) for native ETH, or an ERC-20 (Arc USDC). */
  quote: `0x${string}`;
  /**
   * Native wei per quote unit when the quote is paid with msg.value: 1 for native ETH,
   * 1e12 for Arc USDC (18-dp native balance behind a 6-dp ERC-20).
   */
  nativeScale: bigint;
}

/**
 * Exact-input swap in a Proto Uniswap v4 pool through GotonV4Router.
 * Buys pay the quote with msg.value (no approval). Sells approve exactly the sold amount.
 * `params.amountInWei` / `expectedAmountOut` use native 18-dp units for the quote side.
 */
export async function executeV4RouterSwap(
  network: NetworkConfig,
  quote: V4QuoteConfig,
  params: ChainSwapParams,
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: `0x${string}`,
): Promise<`0x${string}`> {
  const { memeHook, router } = network.contracts;
  if (!isDeployed(memeHook) || !isDeployed(router)) {
    throw new Error(`Uniswap v4 trading is not configured on ${network.name}`);
  }

  const poolKey = protoV4PoolKey(params.tokenAddress, quote.quote, memeHook);
  const zeroForOne =
    params.isBuy === (poolKey.currency0.toLowerCase() === quote.quote.toLowerCase());
  const amountIn = params.isBuy ? params.amountInWei / quote.nativeScale : params.amountInWei;
  const minOutNative = resolveMinAmountOut(
    params.amountOutMinimum,
    params.expectedAmountOut,
    params.slippagePercent,
  );
  const minOut = params.isBuy ? minOutNative : minOutNative / quote.nativeScale;

  if (!params.isBuy) {
    const allowance = await publicClient
      .readContract({
        address: params.tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, router],
      })
      .catch(() => 0n);
    if (allowance < amountIn) {
      const approveHash = await walletClient.writeContract({
        address: params.tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [router, amountIn],
        account,
        chain: walletClient.chain,
      });
      params.onApproveSubmitted?.(approveHash);
      await waitForReceiptWithFallback(publicClient, approveHash, walletClient);
    }
  }

  const hash = await walletClient.writeContract({
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
    chain: walletClient.chain,
  });
  params.onSubmitted?.(hash);
  waitForReceiptWithFallback(publicClient, hash, walletClient).catch(() => {});
  return hash;
}
