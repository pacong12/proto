import { ref } from 'vue';
import { parseAbi, erc20Abi, parseEther } from 'viem';
import { getNetworkConfig, swapRouterAbi } from '@proto/shared-types';
import { getPublicClient, getWalletClient } from '../lib/viem-client';
import { walletChainId } from '../lib/wallet-store';

const bondingCurveAbi = parseAbi([
  'function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut)',
  'function sell(uint256 tokenIn, uint256 minEthOut) external returns (uint256 ethOut)',
  'function graduated() external view returns (bool)',
]);

/**
 * Slippage threshold above which the UI should display a high-slippage warning.
 */
export const SLIPPAGE_WARN_THRESHOLD = 5.0; // percent

/**
 * Maximum slippage value accepted. Values above this are clamped to prevent
 * extreme sandwich attack exposure.
 */
export const SLIPPAGE_MAX = 49.0; // percent

/**
 * Resolve the minimum acceptable output amount for a swap.
 *
 * Priority:
 *   1. An explicit minimum supplied by the caller (already final).
 *   2. Derived from expectedAmountOut and slippagePercent.
 *   3. Neither available: throw to prevent a zero-minimum swap.
 */
function resolveAmountOutMinimum(
  explicitMin: bigint | undefined,
  expectedAmountOut: bigint | undefined,
  slippagePercent: number,
): bigint {
  if (explicitMin !== undefined && explicitMin > 0n) return explicitMin;

  if (expectedAmountOut && expectedAmountOut > 0n) {
    const clampedSlippage = Math.min(Math.max(slippagePercent, 0), SLIPPAGE_MAX);
    // factor = (100 - slippage) * 100 expressed in basis-points-times-100
    const factor = BigInt(Math.floor((100 - clampedSlippage) * 100));
    return (expectedAmountOut * factor) / 10_000n;
  }

  throw new Error(
    'Swap output estimate unavailable. Please retry in a few seconds or refresh the page.',
  );
}

export function useSwap() {
  const isSwapping = ref(false);
  const swapError = ref<string | null>(null);
  const slippage = ref(1.0); // default 1.0%

  /**
   * Execute a swap through the V2 BondingCurve (when token is on curve)
   * or through the Uniswap V3 SwapRouter (V1 direct pool or graduated token).
   *
   * Fixes:
   *   BUG-04 - correct routing for V2 bonding curve tokens
   *   HIGH-01 - amountOutMinimum is never silently 0
   *   C-03    - allowance is checked before approve to avoid redundant transactions
   */
  async function executeSwap(params: {
    tokenAddress: `0x${string}`;
    isBuy: boolean;
    amountInEth: string;
    slippagePercent?: number;
    amountOutMinimum?: bigint;
    expectedAmountOut?: bigint;
    version?: 'v1' | 'v2';
    curveAddress?: `0x${string}`;
    isGraduated?: boolean;
    chainId?: number;
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

      // Use parseEther for full precision; float arithmetic fallback is a last resort.
      let amountInWei: bigint;
      try {
        amountInWei = parseEther(params.amountInEth);
      } catch {
        amountInWei = BigInt(Math.floor(parseFloat(params.amountInEth || '0') * 1e18));
      }

      if (amountInWei <= 0n) throw new Error('Swap amount must be greater than zero');

      const isV2Curve =
        params.version === 'v2' &&
        !params.isGraduated &&
        params.curveAddress &&
        params.curveAddress !== '0x0000000000000000000000000000000000000000';

      if (isV2Curve) {
        if (params.isBuy) {
          // V2 bonding curve buy: send ETH directly to buy().
          const minTokensOut = resolveAmountOutMinimum(
            params.amountOutMinimum,
            params.expectedAmountOut,
            slippagePercent,
          );

          const txHash = await walletClient.writeContract({
            address: params.curveAddress!,
            abi: bondingCurveAbi,
            functionName: 'buy',
            args: [minTokensOut],
            value: amountInWei,
            account,
            chain: walletClient.chain,
          });

          await publicClient.waitForTransactionReceipt({ hash: txHash });
          return txHash;
        } else {
          // V2 bonding curve sell: approve then call sell().
          // Check existing allowance before approving to avoid unnecessary transactions (fix C-03).
          const currentAllowance = await publicClient.readContract({
            address: params.tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account, params.curveAddress!],
          });

          if (currentAllowance < amountInWei) {
            const approveHash = await walletClient.writeContract({
              address: params.tokenAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [params.curveAddress!, amountInWei],
              account,
              chain: walletClient.chain,
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }

          const minEthOut = resolveAmountOutMinimum(
            params.amountOutMinimum,
            params.expectedAmountOut,
            slippagePercent,
          );

          const txHash = await walletClient.writeContract({
            address: params.curveAddress!,
            abi: bondingCurveAbi,
            functionName: 'sell',
            args: [amountInWei, minEthOut],
            account,
            chain: walletClient.chain,
          });

          await publicClient.waitForTransactionReceipt({ hash: txHash });
          return txHash;
        }
      }

      const network = getNetworkConfig(walletChainId.value ?? undefined);

      // Default path: Uniswap V3 SwapRouter.
      const tokenIn = params.isBuy ? network.contracts.weth : params.tokenAddress;
      const tokenOut = params.isBuy ? params.tokenAddress : network.contracts.weth;

      if (!params.isBuy) {
        // Check existing allowance before approving (fix C-03).
        const currentAllowance = await publicClient.readContract({
          address: params.tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, network.contracts.swapRouter],
        });

        if (currentAllowance < amountInWei) {
          const approveHash = await walletClient.writeContract({
            address: params.tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [network.contracts.swapRouter, amountInWei],
            account,
            chain: walletClient.chain,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      const amountOutMinimum = resolveAmountOutMinimum(
        params.amountOutMinimum,
        params.expectedAmountOut,
        slippagePercent,
      );

      const swapHash = await walletClient.writeContract({
        address: network.contracts.swapRouter,
        abi: swapRouterAbi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn,
            tokenOut,
            fee: network.launchConfig.poolFee,
            recipient: account,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
            amountIn: amountInWei,
            amountOutMinimum,
            sqrtPriceLimitX96: 0n,
          },
        ],
        value: params.isBuy ? amountInWei : 0n,
        account,
        chain: walletClient.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: swapHash });
      return swapHash;
    } catch (err) {
      swapError.value = (err as Error).message;
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
