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
  ROBINHOOD_CHAIN,
  launchpadFactoryAbi,
  launchpadV2FactoryAbi,
  robinhoodLaunchpadV2Abi,
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

function extractRobinhoodV2LaunchData(receipt: TransactionReceipt): ChainLaunchResult | null {
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

function extractRobinhoodV1LaunchData(receipt: TransactionReceipt): ChainLaunchResult | null {
  try {
    const v1Events = parseEventLogs({
      abi: launchpadFactoryAbi,
      logs: receipt.logs,
      eventName: 'TokenLaunched',
    });
    if (v1Events.length > 0) {
      return {
        tokenAddress: v1Events[0].args.token,
        poolAddress: v1Events[0].args.pool,
      };
    }
  } catch {
    // fallback
  }

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: launchpadFactoryAbi,
        eventName: 'TokenLaunched',
        topics: log.topics,
        data: log.data,
      });
      if (decoded?.args?.token) {
        return {
          tokenAddress: decoded.args.token,
          poolAddress: decoded.args.pool,
        };
      }
    } catch {
      // continue
    }
  }
  return null;
}

export class RobinhoodChainAdapter implements ChainAdapter {
  readonly network = ROBINHOOD_CHAIN;
  readonly chainId = ROBINHOOD_CHAIN.chainId;
  readonly isArc = false;

  async launchToken(
    params: ChainLaunchParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
    onHashEmitted?: (hash: `0x${string}`) => void,
  ): Promise<ChainLaunchResult | null> {
    const targetFactory = this.network.contracts.factoryV2;
    const isV2 = Boolean(
      targetFactory && targetFactory !== '0x0000000000000000000000000000000000000000',
    );

    if (isV2) {
      const isPonsLegacy =
        targetFactory!.toLowerCase() === '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';

      let hash: `0x${string}`;
      if (isPonsLegacy) {
        // Legacy Pons contract support if explicitly configured
        hash = await walletClient.writeContract({
          address: targetFactory!,
          abi: robinhoodLaunchpadV2Abi,
          functionName: 'launchToken',
          args: [
            {
              name: params.name,
              symbol: params.symbol,
              logo: params.logo,
              description: params.description,
              socials: {
                twitter: params.socials.twitter ?? '',
                telegram: params.socials.telegram ?? '',
                discord: params.socials.discord ?? '',
                website: params.socials.website ?? '',
                farcaster: params.socials.farcaster ?? '',
              },
              creatorFeeRecipient: account,
              feeConfig: 0,
              isFair: false,
              b1: '0x0000000000000000000000000000000000000000000000000000000000000000',
              b2: '0x0000000000000000000000000000000000000000000000000000000000000000',
            },
            0n,
            '0x0000000000000000000000000000000000000000',
          ],
          value: this.network.launchConfig.launchFeeWei,
          account,
          chain: walletClient.chain,
        });
      } else {
        // Proto Canonical LaunchpadV2Factory on Robinhood Chain
        const initialBuyWei = parseInitialBuyWei(params.initialBuyAmountEth);
        const totalValue = this.network.launchConfig.launchFeeWei + initialBuyWei;

        hash = await walletClient.writeContract({
          address: targetFactory!,
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
      }

      onHashEmitted?.(hash);
      const receipt = await waitForReceiptWithFallback(publicClient, hash, walletClient);
      if (!receipt) return null;
      if (receipt.status === 'reverted') {
        throw new Error(
          `Transaction reverted on-chain. Hash: ${hash}. Block: ${receipt.blockNumber}.`,
        );
      }
      const launchResult = extractRobinhoodV2LaunchData(receipt);
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
            functionName: 'proposeTaxConfig',
            args: [buyTaxBps, sellTaxBps, recipient],
            account,
            chain: walletClient.chain,
          });
          await waitForReceiptWithFallback(publicClient, taxHash, walletClient);
        } catch (taxErr) {
          console.warn('[RobinhoodAdapter] Post-launch proposeTaxConfig skipped or deferred:', taxErr);
        }
      }
      return launchResult;
    } else {
      // Robinhood V1 Launch
      const initialBuyWei = parseInitialBuyWei(params.initialBuyAmountEth);
      const totalValue = this.network.launchConfig.launchFeeWei + initialBuyWei;

      const hash = await walletClient.writeContract({
        address: this.network.contracts.factory,
        abi: launchpadFactoryAbi,
        functionName: 'launchToken',
        args: [
          params.name,
          params.symbol,
          params.logo,
          params.description,
          {
            twitter: params.socials.twitter ?? '',
            telegram: params.socials.telegram ?? '',
            discord: params.socials.discord ?? '',
            website: params.socials.website ?? '',
            farcaster: params.socials.farcaster ?? '',
          },
          initialBuyWei,
        ],
        value: totalValue,
        account,
        chain: walletClient.chain,
      });

      onHashEmitted?.(hash);
      const receipt = await waitForReceiptWithFallback(publicClient, hash, walletClient);
      if (!receipt) return null;
      if (receipt.status === 'reverted') {
        throw new Error(
          `Transaction reverted on-chain. Hash: ${hash}. Block: ${receipt.blockNumber}.`,
        );
      }
      const v1Result = extractRobinhoodV1LaunchData(receipt);
      if (
        v1Result &&
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
            address: v1Result.tokenAddress,
            abi: launchpadTokenAbi,
            functionName: 'proposeTaxConfig',
            args: [buyTaxBps, sellTaxBps, recipient],
            account,
            chain: walletClient.chain,
          });
          await waitForReceiptWithFallback(publicClient, taxHash, walletClient);
        } catch (taxErr) {
          console.warn(
            '[RobinhoodAdapter] Post-launch V1 proposeTaxConfig skipped or deferred:',
            taxErr,
          );
        }
      }
      return v1Result;
    }
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
        let expectedOut = params.expectedAmountOut;
        if (!expectedOut || expectedOut <= 0n) {
          try {
            const [quoted] = await publicClient.readContract({
              address: params.curveAddress!,
              abi: bondingCurveAbi,
              functionName: 'getAmountOutBuy',
              args: [params.amountInWei],
            });
            if (quoted > 0n) expectedOut = quoted;
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
        // Curve Sell on Robinhood
        let sellTokenAmount = params.amountInWei;
        try {
          const curveBalance = await publicClient.getBalance({ address: params.curveAddress! });
          if (curveBalance > 0n) {
            let [quoteEth, quoteFee] = await publicClient.readContract({
              address: params.curveAddress!,
              abi: bondingCurveAbi,
              functionName: 'getAmountOutSell',
              args: [sellTokenAmount],
            });
            let it = 0;
            while (
              quoteEth + quoteFee > curveBalance &&
              it < 5 &&
              sellTokenAmount > 1_000_000_000n
            ) {
              const step = 1_000_000_000n * BigInt(10 ** it);
              sellTokenAmount = sellTokenAmount > step ? sellTokenAmount - step : 0n;
              [quoteEth, quoteFee] = await publicClient.readContract({
                address: params.curveAddress!,
                abi: bondingCurveAbi,
                functionName: 'getAmountOutSell',
                args: [sellTokenAmount],
              });
              it++;
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
          const [quoted] = await publicClient.readContract({
            address: params.curveAddress!,
            abi: bondingCurveAbi,
            functionName: 'getAmountOutSell',
            args: [sellTokenAmount],
          });
          if (quoted > 0n) expectedOut = quoted;
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

    // Default: Uniswap V3 SwapRouter on Robinhood
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

export const robinhoodChainAdapter = new RobinhoodChainAdapter();
