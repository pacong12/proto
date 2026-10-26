import { parseEventLogs, type PublicClient, type WalletClient } from 'viem';
import { ROBINHOOD_CHAIN, launchpadV2FactoryAbi, gotonV4GraduatorAbi } from '@goton/shared-types';
import { revenueSplitToBps, taxPercentToBps } from '@goton/math-sdk';
import type { ChainAdapter, ChainLaunchParams, ChainLaunchResult, ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { executeCurveSwap, isCurveTrade } from '../shared/curve-swap';
import { executeV4RouterSwap } from '../shared/v4-swap';
import { isDeployed, parseInitialBuyWei } from '../shared/utils';

const NATIVE_ETH = '0x0000000000000000000000000000000000000000' as const;

/**
 * Robinhood Chain: bonding curve, then permissionless graduation into a locked native-ETH
 * Uniswap v4 pool (GotonV4Graduator). Post-graduation trades go through GotonV4Router.
 */
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
    const factory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!isDeployed(factory)) {
      throw new Error(`Factory contract not deployed on ${this.network.name}`);
    }

    const initialBuyWei = parseInitialBuyWei(params.initialBuyAmountEth);
    const launchArgs = [
      params.name,
      params.symbol,
      params.logo,
      params.description,
      params.socials.twitter ?? '',
      params.socials.telegram ?? '',
      params.socials.website ?? '',
      params.minInitialTokensOut ?? 0n,
    ] as const;
    // The token accepts an initial tax only within two blocks of launch (~0.2 s here), so the
    // tax goes into the launch transaction itself; a follow-up transaction would always miss it.
    const buyTaxBps = taxPercentToBps(params.buyTaxPercent ?? 0);
    const sellTaxBps = taxPercentToBps(params.sellTaxPercent ?? 0);
    const hasTax = buyTaxBps > 0 || sellTaxBps > 0;
    const value = this.network.launchConfig.launchFeeWei + initialBuyWei;
    const hash = hasTax
      ? await walletClient.writeContract({
          address: factory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launchTokenV2WithTax',
          args: [
            ...launchArgs,
            {
              buyTaxBps,
              sellTaxBps,
              taxRecipient: params.creatorTaxWallet ?? account,
            },
          ],
          value,
          account,
          chain: walletClient.chain,
        })
      : await walletClient.writeContract({
          address: factory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launchTokenV2',
          args: launchArgs,
          value,
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

    const [launch] = parseEventLogs({
      abi: launchpadV2FactoryAbi,
      logs: receipt.logs,
      eventName: 'TokenLaunchedV2',
    });
    if (!launch) return null;
    const result: ChainLaunchResult = {
      tokenAddress: launch.args.token,
      curveAddress: launch.args.curve,
      poolAddress: launch.args.curve,
      // Set in the launch transaction, which was mined successfully.
      taxApplied: true,
    };

    // The revenue split is a follow-up transaction that only succeeds before any third-party buy
    // (S18), so it is sent right after the launch is mined. GotonV4Graduator enforces it at
    // graduation; the caller is told when it did not land, so the creator can retry.
    result.splitApplied = params.revenueSplit
      ? await this.applyRevenueSplit(
          result.tokenAddress,
          params.revenueSplit,
          walletClient,
          publicClient,
          account,
        )
      : true;
    return result;
  }

  async applyRevenueSplit(
    tokenAddress: `0x${string}`,
    revenueSplit: NonNullable<ChainLaunchParams['revenueSplit']>,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<boolean> {
    const { graduator } = this.network.contracts;
    if (!isDeployed(graduator)) return false;
    try {
      const split = revenueSplitToBps(revenueSplit);
      const splitHash = await walletClient.writeContract({
        address: graduator,
        abi: gotonV4GraduatorAbi,
        functionName: 'setRevenueSplit',
        args: [tokenAddress, split.holdersBps, split.burnBps, split.creatorBps, split.liquidityBps],
        account,
        chain: walletClient.chain,
      });
      const receipt = await waitForReceiptWithFallback(publicClient, splitHash, walletClient);
      return receipt?.status === 'success';
    } catch (err) {
      console.warn('[RobinhoodChainAdapter] Revenue split was not applied:', err);
      return false;
    }
  }

  /**
   * Graduation is permissionless: if the curve finished but nobody has moved its liquidity into
   * the v4 pool yet, the first post-graduation trader does it (factory.graduate) before swapping.
   */
  private async ensureGraduated(
    params: ChainSwapParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<void> {
    const { graduator } = this.network.contracts;
    const factory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!isDeployed(graduator) || !isDeployed(factory)) return;
    const [splitter] = await publicClient.readContract({
      address: graduator,
      abi: gotonV4GraduatorAbi,
      functionName: 'graduations',
      args: [params.tokenAddress],
    });
    if (isDeployed(splitter)) return;

    const hash = await walletClient.writeContract({
      address: factory,
      abi: launchpadV2FactoryAbi,
      functionName: 'graduate',
      args: [params.tokenAddress],
      account,
      chain: walletClient.chain,
    });
    params.onApproveSubmitted?.(hash);
    const receipt = await waitForReceiptWithFallback(publicClient, hash, walletClient);
    if (receipt?.status !== 'success') {
      throw new Error(`Graduating the token into its Uniswap v4 pool failed. Hash: ${hash}`);
    }
  }

  async executeSwap(
    params: ChainSwapParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<string | null> {
    if (isCurveTrade(params)) {
      return executeCurveSwap(params, walletClient, publicClient, account);
    }
    await this.ensureGraduated(params, walletClient, publicClient, account);
    return executeV4RouterSwap(
      this.network,
      { quote: NATIVE_ETH, nativeScale: 1n },
      params,
      walletClient,
      publicClient,
      account,
    );
  }
}

export const robinhoodChainAdapter = new RobinhoodChainAdapter();
