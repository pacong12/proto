import { ref } from 'vue';
import { parseAbi, erc20Abi } from 'viem';
import { ROBINHOOD_CHAIN, swapRouterAbi } from '@proto/shared-types';
import { publicClient, getWalletClient } from '../lib/viem-client';

const bondingCurveAbi = parseAbi([
  'function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut)',
  'function sell(uint256 tokenIn, uint256 minEthOut) external returns (uint256 ethOut)',
  'function graduated() external view returns (bool)',
]);

export function useSwap() {
  const isSwapping = ref(false);
  const swapError = ref<string | null>(null);
  const slippage = ref(1.0); // Default 1.0%

  /**
   * Executes swap either through V2 BondingCurve directly (if on curve)
   * or through Uniswap V3 SwapRouter (if V1 direct pool or graduated).
   * Resolves BUG-04.
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
  }): Promise<string | null> {
    isSwapping.value = true;
    swapError.value = null;

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('Wallet not connected');

      const [account] = await walletClient.getAddresses();
      if (!account) throw new Error('No active account selected');

      const slippagePercent = params.slippagePercent ?? slippage.value ?? 1.0;
      const amountInWei = BigInt(Math.floor(parseFloat(params.amountInEth) * 1e18));

      // Check if trading on V2 Bonding Curve
      const isV2Curve =
        params.version === 'v2' &&
        !params.isGraduated &&
        params.curveAddress &&
        params.curveAddress !== '0x0000000000000000000000000000000000000000';

      if (isV2Curve) {
        if (params.isBuy) {
          // V2 Bonding Curve: buy() directly with ETH
          let minTokensOut = params.amountOutMinimum ?? 0n;
          if (minTokensOut === 0n && params.expectedAmountOut) {
            const factor = BigInt(Math.max(0, Math.floor((100 - slippagePercent) * 100)));
            minTokensOut = (params.expectedAmountOut * factor) / 10000n;
          }

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
          // V2 Bonding Curve: sell() tokens back for ETH
          // 1. Approve tokens to BondingCurve contract
          const approveHash = await walletClient.writeContract({
            address: params.tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [params.curveAddress!, amountInWei],
            account,
            chain: walletClient.chain,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });

          let minEthOut = params.amountOutMinimum ?? 0n;
          if (minEthOut === 0n && params.expectedAmountOut) {
            const factor = BigInt(Math.max(0, Math.floor((100 - slippagePercent) * 100)));
            minEthOut = (params.expectedAmountOut * factor) / 10000n;
          }

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

      // Default: Uniswap V3 Pool Swap
      const tokenIn = params.isBuy ? ROBINHOOD_CHAIN.contracts.weth : params.tokenAddress;
      const tokenOut = params.isBuy ? params.tokenAddress : ROBINHOOD_CHAIN.contracts.weth;

      if (!params.isBuy) {
        // Approve token to swap router
        const approveHash = await walletClient.writeContract({
          address: params.tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ROBINHOOD_CHAIN.contracts.swapRouter, amountInWei],
          account,
          chain: walletClient.chain,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      let amountOutMinimum = params.amountOutMinimum ?? 0n;
      if (amountOutMinimum === 0n && params.expectedAmountOut) {
        const factor = BigInt(Math.max(0, Math.floor((100 - slippagePercent) * 100)));
        amountOutMinimum = (params.expectedAmountOut * factor) / 10000n;
      }

      const swapHash = await walletClient.writeContract({
        address: ROBINHOOD_CHAIN.contracts.swapRouter,
        abi: swapRouterAbi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn,
            tokenOut,
            fee: ROBINHOOD_CHAIN.launchConfig.poolFee,
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
