import type { PublicClient, WalletClient } from 'viem';
import { bondingCurveAbi } from '@goton/shared-types';
import type { ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { ensureAllowance } from '../../lib/wallet-tx';
import { resolveMinAmountOut, swapGasLimit } from './utils';

/** True when the token still trades on its bonding curve (not graduated, curve known). */
export function isCurveTrade(params: ChainSwapParams): boolean {
  return (
    !params.isGraduated &&
    Boolean(params.curveAddress) &&
    params.curveAddress !== '0x0000000000000000000000000000000000000000'
  );
}

/**
 * Buys / sells on a Goton BondingCurve (chain-agnostic; the quote is the native currency).
 * Sells approve exactly the amount being sold (FO-03: no unlimited allowances).
 */
export async function executeCurveSwap(
  params: ChainSwapParams,
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: `0x${string}`,
): Promise<`0x${string}`> {
  if (params.isBuy) {
    // Send the native quote (ETH, or Arc native USDC in 18 dp) straight to buy().
    // Prefer the on-chain quote, as sells do: the caller's estimate comes from cached market data,
    // and a stale one either fails the buy or silently loosens the slippage floor.
    let expectedOut: bigint | undefined;
    try {
      const [quotedTokens] = await publicClient.readContract({
        address: params.curveAddress!,
        abi: bondingCurveAbi,
        functionName: 'getAmountOutBuy',
        args: [params.amountInWei],
      });
      if (quotedTokens > 0n) expectedOut = quotedTokens;
    } catch {
      // fall back to the caller's estimate
    }
    expectedOut ??= params.expectedAmountOut;

    const minTokensOut = resolveMinAmountOut(
      params.amountOutMinimum,
      expectedOut,
      params.slippagePercent,
    );

    const buy = {
      address: params.curveAddress!,
      abi: bondingCurveAbi,
      functionName: 'buy',
      args: [minTokensOut],
      value: params.amountInWei,
      account,
    } as const;
    const txHash = await walletClient.writeContract({
      ...buy,
      gas: await swapGasLimit(publicClient, buy),
      chain: walletClient.chain,
    });

    params.onSubmitted?.(txHash);
    waitForReceiptWithFallback(publicClient, txHash, walletClient).catch(() => {});
    return txHash;
  } else {
    // V2 bonding curve sell
    let sellTokenAmount = params.amountInWei;
    try {
      const curveBalance = await publicClient.getBalance({ address: params.curveAddress! });
      if (curveBalance > 0n) {
        let [quoteEthOut, quoteFee] = await publicClient.readContract({
          address: params.curveAddress!,
          abi: bondingCurveAbi,
          functionName: 'getAmountOutSell',
          args: [sellTokenAmount],
        });
        let iterations = 0;
        while (
          quoteEthOut + quoteFee > curveBalance &&
          iterations < 5 &&
          sellTokenAmount > 1_000_000_000n
        ) {
          const step = 1_000_000_000n * BigInt(10 ** iterations);
          sellTokenAmount = sellTokenAmount > step ? sellTokenAmount - step : 0n;
          [quoteEthOut, quoteFee] = await publicClient.readContract({
            address: params.curveAddress!,
            abi: bondingCurveAbi,
            functionName: 'getAmountOutSell',
            args: [sellTokenAmount],
          });
          iterations++;
        }
      }
    } catch {
      // fallback
    }

    await ensureAllowance({
      publicClient,
      walletClient,
      account,
      token: params.tokenAddress,
      spender: params.curveAddress!,
      amount: sellTokenAmount,
      onSubmitted: params.onApproveSubmitted,
    });

    let expectedOut = params.expectedAmountOut;
    try {
      const [quotedEth] = await publicClient.readContract({
        address: params.curveAddress!,
        abi: bondingCurveAbi,
        functionName: 'getAmountOutSell',
        args: [sellTokenAmount],
      });
      if (quotedEth > 0n) expectedOut = quotedEth;
    } catch {
      // fallback
    }

    const minEthOut = resolveMinAmountOut(
      params.amountOutMinimum,
      expectedOut,
      params.slippagePercent,
    );

    const sell = {
      address: params.curveAddress!,
      abi: bondingCurveAbi,
      functionName: 'sell',
      args: [sellTokenAmount, minEthOut],
      account,
    } as const;
    const txHash = await walletClient.writeContract({
      ...sell,
      gas: await swapGasLimit(publicClient, sell),
      chain: walletClient.chain,
    });

    params.onSubmitted?.(txHash);
    waitForReceiptWithFallback(publicClient, txHash, walletClient).catch(() => {});
    return txHash;
  }
}
