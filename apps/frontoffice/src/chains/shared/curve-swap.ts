import { erc20Abi, type PublicClient, type WalletClient } from 'viem';
import { bondingCurveAbi } from '@goton/shared-types';
import type { ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { resolveMinAmountOut } from './utils';

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
    let expectedOut = params.expectedAmountOut;
    if (!expectedOut || expectedOut <= 0n) {
      try {
        const [quotedTokens] = await publicClient.readContract({
          address: params.curveAddress!,
          abi: bondingCurveAbi,
          functionName: 'getAmountOutBuy',
          args: [params.amountInWei],
        });
        if (quotedTokens > 0n) expectedOut = quotedTokens;
      } catch {
        // fallback
      }
    }

    const minTokensOut = resolveMinAmountOut(
      params.amountOutMinimum,
      expectedOut,
      params.slippagePercent,
    );

    const txHash = await walletClient.writeContract({
      address: params.curveAddress!,
      abi: bondingCurveAbi,
      functionName: 'buy',
      args: [minTokensOut],
      value: params.amountInWei,
      account,
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

    let currentAllowance = 0n;
    try {
      currentAllowance = await publicClient.readContract({
        address: params.tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, params.curveAddress!],
      });
    } catch {
      currentAllowance = 0n;
    }

    if (currentAllowance < sellTokenAmount) {
      const approveHash = await walletClient.writeContract({
        address: params.tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [params.curveAddress!, sellTokenAmount],
        account,
        chain: walletClient.chain,
      });
      params.onApproveSubmitted?.(approveHash);
    }

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

    const txHash = await walletClient.writeContract({
      address: params.curveAddress!,
      abi: bondingCurveAbi,
      functionName: 'sell',
      args: [sellTokenAmount, minEthOut],
      account,
      chain: walletClient.chain,
    });

    params.onSubmitted?.(txHash);
    waitForReceiptWithFallback(publicClient, txHash, walletClient).catch(() => {});
    return txHash;
  }
}
