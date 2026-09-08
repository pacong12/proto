import { ref } from 'vue';
import { parseAbi } from 'viem';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';
import { publicClient, getWalletClient } from '../lib/viem-client';

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
]);

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 value) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

export function useSwap() {
  const isSwapping = ref(false);
  const swapError = ref<string | null>(null);
  const slippage = ref<number>(1.0); // Default slippage tolerance 1.0%

  async function executeSwap(params: {
    tokenAddress: `0x${string}`;
    isBuy: boolean;
    amountInEth: string;
    slippagePercent?: number;
    amountOutMinimum?: bigint;
    expectedAmountOut?: bigint;
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
