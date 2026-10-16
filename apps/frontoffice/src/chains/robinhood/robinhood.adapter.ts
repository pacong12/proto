import { parseEventLogs, type PublicClient, type WalletClient } from 'viem';
import {
  ROBINHOOD_CHAIN,
  launchpadTokenAbi,
  launchpadV2FactoryAbi,
  protoV4GraduatorAbi,
} from '@goton/shared-types';
import { revenueSplitToBps, taxPercentToBps } from '@goton/math-sdk';
import type { ChainAdapter, ChainLaunchParams, ChainLaunchResult, ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { executeCurveSwap, isCurveTrade } from '../shared/curve-swap';
import { executeV4RouterSwap } from '../shared/v4-swap';
import { isDeployed, parseInitialBuyWei } from '../shared/utils';

const NATIVE_ETH = '0x0000000000000000000000000000000000000000' as const;

/**
 * Robinhood Chain: bonding curve, then permissionless graduation into a locked native-ETH
 * Uniswap v4 pool (ProtoV4Graduator). Post-graduation trades go through ProtoV4Router.
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
    const hash = await walletClient.writeContract({
      address: factory,
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
      value: this.network.launchConfig.launchFeeWei + initialBuyWei,
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
      taxApplied: false,
    };

    // Creator tax and revenue split are follow-up transactions that only succeed before any
    // third-party buy (S18), so they are sent right after the launch is mined.
    const buyTaxBps = taxPercentToBps(params.buyTaxPercent ?? 0);
    const sellTaxBps = taxPercentToBps(params.sellTaxPercent ?? 0);
    result.taxApplied = buyTaxBps === 0 && sellTaxBps === 0;
    if (!result.taxApplied) {
      try {
        const taxHash = await walletClient.writeContract({
          address: result.tokenAddress,
          abi: launchpadTokenAbi,
          functionName: 'setInitialTaxConfig',
          args: [buyTaxBps, sellTaxBps, params.creatorTaxWallet ?? account],
          account,
          chain: walletClient.chain,
        });
        const taxReceipt = await waitForReceiptWithFallback(publicClient, taxHash, walletClient);
        result.taxApplied = taxReceipt?.status === 'success';
      } catch (err) {
        console.warn('[RobinhoodChainAdapter] Initial tax was not applied:', err);
      }
    }

    // The LP-fee split is enforced at graduation by ProtoV4Graduator (set once, before public trading).
    const { graduator } = this.network.contracts;
    if (params.revenueSplit && isDeployed(graduator)) {
      try {
        const split = revenueSplitToBps(params.revenueSplit);
        const splitHash = await walletClient.writeContract({
          address: graduator,
          abi: protoV4GraduatorAbi,
          functionName: 'setRevenueSplit',
          args: [
            result.tokenAddress,
            split.holdersBps,
            split.burnBps,
            split.creatorBps,
            split.liquidityBps,
          ],
          account,
          chain: walletClient.chain,
        });
        await waitForReceiptWithFallback(publicClient, splitHash, walletClient);
      } catch (err) {
        console.warn('[RobinhoodChainAdapter] Revenue split was not applied:', err);
      }
    }
    return result;
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
      abi: protoV4GraduatorAbi,
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
