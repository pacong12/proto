import { ref } from 'vue';
import { erc20Abi, parseUnits } from 'viem';
import { getPublicClient, getWalletClient } from '../lib/viem-client';
import { walletChainId } from '../lib/wallet-store';
import { getChainAdapter } from '../chains';

/**
 * Robustly parses any string, number, or bigint input into wei/base units.
 * Handles scientific notation, commas, and trailing decimals without throwing.
 */
export function parseAmountToWei(rawAmount: unknown, decimals = 18): bigint {
  if (typeof rawAmount === 'bigint') return rawAmount;
  if (rawAmount === null || rawAmount === undefined) return 0n;

  const str = typeof rawAmount === 'string' ? rawAmount.trim() : String(rawAmount).trim();
  if (!str || str === '0') return 0n;

  try {
    return parseUnits(str, decimals);
  } catch {
    if (str.includes('e') || str.includes('E')) {
      const num = Number(str);
      if (!Number.isFinite(num) || num <= 0) return 0n;
      const fixed = num.toFixed(decimals);
      return parseUnits(fixed, decimals);
    }
    const clean = str.replace(/[^0-9.]/g, '');
    const [whole = '0', frac = ''] = clean.split('.');
    const paddedFrac = frac.slice(0, decimals).padEnd(decimals, '0');
    return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(paddedFrac || '0');
  }
}

export const SLIPPAGE_WARN_THRESHOLD = 5.0; // percent
export const SLIPPAGE_MAX = 49.0; // percent

function isUserRejection(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? '').toLowerCase();
  const code = (err as { code?: number })?.code;
  return (
    code === 4001 ||
    msg.includes('user reject') ||
    msg.includes('user denied') ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    msg.includes('action_rejected') ||
    msg.includes('rejected the request') ||
    msg.includes('rejected by user') ||
    msg.includes('transaction was rejected') ||
    msg.includes('request rejected')
  );
}

export function useSwap() {
  const isSwapping = ref(false);
  const swapError = ref<string | null>(null);
  const slippage = ref(1.0); // default 1.0%

  async function executeSwap(params: {
    tokenAddress: `0x${string}`;
    isBuy: boolean;
    amountInEth: string | number | bigint;
    slippagePercent?: number;
    amountOutMinimum?: bigint;
    expectedAmountOut?: bigint;
    version?: 'v1' | 'v2';
    curveAddress?: `0x${string}`;
    isGraduated?: boolean;
    chainId?: number;
    tokenDecimals?: number;
    onSubmitted?: (txHash: `0x${string}`) => void;
    onApproveSubmitted?: (approveHash: `0x${string}`) => void;
  }): Promise<string | null> {
    isSwapping.value = true;
    swapError.value = null;

    try {
      const publicClient = getPublicClient(params.chainId);
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('Wallet not connected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('No active account selected');

      const slippagePercent = params.slippagePercent ?? slippage.value ?? 1.0;

      if (slippagePercent > SLIPPAGE_WARN_THRESHOLD) {
        console.warn(`[useSwap] High slippage: ${slippagePercent}%. Confirm user acknowledged.`);
      }

      const decimals = params.isBuy ? 18 : params.tokenDecimals || 18;
      let amountInWei = parseAmountToWei(params.amountInEth, decimals);

      if (amountInWei <= 0n) throw new Error('Swap amount must be greater than zero');

      if (!params.isBuy) {
        try {
          const userBalance = await publicClient.readContract({
            address: params.tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
          });
          if (userBalance > 0n && amountInWei > userBalance) {
            amountInWei = userBalance;
          }
        } catch {
          // non-blocking
        }
      }

      // Clean Architecture: Delegate swap execution to dedicated chain adapter (Strategy Pattern)
      const targetChainId = params.chainId ?? walletChainId.value ?? undefined;
      const chainAdapter = getChainAdapter(targetChainId);

      return await chainAdapter.executeSwap(
        {
          tokenAddress: params.tokenAddress,
          isBuy: params.isBuy,
          amountInWei,
          slippagePercent,
          expectedAmountOut: params.expectedAmountOut,
          amountOutMinimum: params.amountOutMinimum,
          curveAddress: params.curveAddress,
          isGraduated: params.isGraduated,
          onSubmitted: params.onSubmitted,
          onApproveSubmitted: params.onApproveSubmitted,
        },
        walletClient,
        publicClient,
        account,
      );
    } catch (err) {
      if (isUserRejection(err)) {
        swapError.value = null;
      } else {
        swapError.value = (err as Error).message || 'Swap execution failed';
      }
      return null;
    } finally {
      isSwapping.value = false;
    }
  }

  return {
    isSwapping,
    swapError,
    slippage,
    executeSwap,
  };
}
