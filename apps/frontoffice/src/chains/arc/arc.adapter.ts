import {
  parseEther,
  erc20Abi,
  decodeEventLog,
  parseEventLogs,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
} from 'viem';
import {
  ARC_CHAIN,
  launchpadV2FactoryAbi,
  launchpadTokenAbi,
  bondingCurveAbi,
  swapRouterAbi,
} from '@proto/shared-types';
import type { ChainAdapter, ChainLaunchParams, ChainLaunchResult, ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';

function parseInitialBuyWei(raw?: string): bigint {
  if (!raw) return 0n;
  const clean = raw.trim();
  if (!clean || clean === '0') return 0n;
  try {
    return parseEther(clean);
  } catch {
    const num = parseFloat(clean);
    if (!Number.isFinite(num) || num <= 0) return 0n;
    return parseEther(num.toFixed(6));
  }
}

function resolveMinAmountOut(
  explicitMin: bigint | undefined,
  expectedOut: bigint | undefined,
  slippagePercent: number,
): bigint {
  if (explicitMin !== undefined && explicitMin > 0n) return explicitMin;
  if (expectedOut && expectedOut > 0n) {
    const clampedSlippage = Math.min(Math.max(slippagePercent, 0), 49.0);
    const factor = BigInt(Math.floor((100 - clampedSlippage) * 100));
    return (expectedOut * factor) / 10_000n;
  }
  throw new Error('Swap output estimate unavailable. Please retry in a few seconds.');
}

function extractArcLaunchData(receipt: TransactionReceipt): ChainLaunchResult | null {
  try {
    const events = parseEventLogs({
      abi: launchpadV2FactoryAbi,
      logs: receipt.logs,
      eventName: 'TokenLaunchedV2',
    });
    if (events.length > 0) {
      return {
        tokenAddress: events[0].args.token,
        curveAddress: events[0].args.curve,
        poolAddress: events[0].args.curve,
      };
    }
  } catch {
    // fallback
  }

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: launchpadV2FactoryAbi,
        eventName: 'TokenLaunchedV2',
        topics: log.topics,
        data: log.data,
      });
      if (decoded?.args?.token) {
        return {
          tokenAddress: decoded.args.token,
          curveAddress: decoded.args.curve,
          poolAddress: decoded.args.curve,
        };
      }
    } catch {
      // continue
    }
  }
  return null;
}

export class ArcChainAdapter implements ChainAdapter {
  readonly network = ARC_CHAIN;
  readonly chainId = ARC_CHAIN.chainId;
  readonly isArc = true;

  async launchToken(
    params: ChainLaunchParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
    onHashEmitted?: (hash: `0x${string}`) => void,
  ): Promise<ChainLaunchResult | null> {
    const targetFactory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!targetFactory || targetFactory === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Factory contract not deployed on ${this.network.name}`);
    }

    const initialBuyWei = parseInitialBuyWei(params.initialBuyAmountEth);
    const totalValue = this.network.launchConfig.launchFeeWei + initialBuyWei;

    const isOld7ArgFactory =
      targetFactory.toLowerCase() === '0x48844223abdceeb1ce502f54d559681358e68200';

    const hash = isOld7ArgFactory
      ? await walletClient.writeContract({
          address: targetFactory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launchTokenV2',
          args: [
            params.name,
            params.symbol,
            params.logo,
            params.description,
            params.socials.twitter ?? '',
            params.socials.telegram ?? '',
            params.socials.website ?? '',
          ],
          value: totalValue,
          account,
          chain: walletClient.chain,
        })
      : await walletClient.writeContract({
          address: targetFactory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launchTokenV2',
          args: [
            params.name,
            params.symbol,
            params.logo,
            params.description,
            params.socials.twitter ?? '',
            params.socials.telegram ?? '',
            params.socials.website ?? '',
            params.minInitialTokensOut ?? 0n,
          ],
          value: totalValue,
          account,
          chain: walletClient.chain,
        });

    onHashEmitted?.(hash);

    const receipt = await waitForReceiptWithFallback(publicClient, hash, walletClient);
    if (!receipt) {
      return null;
    }
    if (receipt.status === 'reverted') {
      throw new Error(
        `Transaction reverted on-chain. Hash: ${hash}. Block: ${receipt.blockNumber}.`,
      );
    }

    const launchResult = extractArcLaunchData(receipt);
    if (
      launchResult &&
      ((params.buyTaxPercent && params.buyTaxPercent > 0) ||
        (params.sellTaxPercent && params.sellTaxPercent > 0))
    ) {
      try {
        const buyTaxBps = Math.min(
          1000,
          Math.max(0, Math.round((params.buyTaxPercent || 0) * 100)),
        );
        const sellTaxBps = Math.min(
          1000,
          Math.max(0, Math.round((params.sellTaxPercent || 0) * 100)),
        );
        const recipient = params.creatorTaxWallet || account;
        const taxHash = await walletClient.writeContract({
          address: launchResult.tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'setTaxConfig',
          args: [buyTaxBps, sellTaxBps, recipient],
          account,
          chain: walletClient.chain,
        });
        await waitForReceiptWithFallback(publicClient, taxHash, walletClient);
      } catch (taxErr) {
        console.warn('[ArcAdapter] Post-launch setTaxConfig skipped or deferred:', taxErr);
      }
    }

    return launchResult;
  }

  async executeSwap(
    params: ChainSwapParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<string | null> {
    const isV2Curve =
      !params.isGraduated &&
      Boolean(params.curveAddress) &&
      params.curveAddress !== '0x0000000000000000000000000000000000000000';

    if (isV2Curve) {
      if (params.isBuy) {
        // V2 bonding curve buy: send native USDC (18 decimals) directly to buy()
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
          const maxUint256 = 2n ** 256n - 1n;
          const approveHash = await walletClient.writeContract({
            address: params.tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [params.curveAddress!, maxUint256],
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

    // Uniswap V3 path on Arc (graduated tokens)
    const tokenIn = params.isBuy ? this.network.contracts.weth : params.tokenAddress;
    const tokenOut = params.isBuy ? params.tokenAddress : this.network.contracts.weth;

    if (!params.isBuy) {
      let currentAllowance = 0n;
      try {
        currentAllowance = await publicClient.readContract({
          address: params.tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, this.network.contracts.swapRouter],
        });
      } catch {
        currentAllowance = 0n;
      }

      if (currentAllowance < params.amountInWei) {
        const maxUint256 = 2n ** 256n - 1n;
        const approveHash = await walletClient.writeContract({
          address: params.tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [this.network.contracts.swapRouter, maxUint256],
          account,
          chain: walletClient.chain,
        });
        params.onApproveSubmitted?.(approveHash);
      }
    }

    const minAmountOut = resolveMinAmountOut(
      params.amountOutMinimum,
      params.expectedAmountOut,
      params.slippagePercent,
    );

    const swapHash = await walletClient.writeContract({
      address: this.network.contracts.swapRouter,
      abi: swapRouterAbi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn,
          tokenOut,
          fee: this.network.launchConfig.poolFee,
          recipient: account,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
          amountIn: params.amountInWei,
          amountOutMinimum: minAmountOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
      value: params.isBuy ? params.amountInWei : 0n,
      account,
      chain: walletClient.chain,
    });

    params.onSubmitted?.(swapHash);
    waitForReceiptWithFallback(publicClient, swapHash, walletClient).catch(() => {});
    return swapHash;
  }
}

export const arcChainAdapter = new ArcChainAdapter();
