import { formatEther, parseEventLogs, type PublicClient, type WalletClient } from 'viem';
import { ARC_CHAIN, launchpadV2FactoryArcAbi } from '@goton/shared-types';
import { revenueSplitToBps, taxPercentToBps } from '@goton/math-sdk';
import type { ChainAdapter, ChainLaunchParams, ChainLaunchResult, ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { executeCurveSwap, isCurveTrade } from '../shared/curve-swap';
import { executeV4RouterSwap } from '../shared/v4-swap';
import { isDeployed, parseInitialBuyWei } from '../shared/utils';

/** Native USDC wei (18 dp) per unit of the 6-dp USDC ERC-20. */
const USDC_WEI_PER_UNIT = 10n ** 12n;

/**
 * Arc Network: tokens launch straight into a Uniswap v4 pool (Argus portal model). Taxes and
 * the revenue split are fixed at launch by LaunchpadV2FactoryArc; trading goes through
 * ProtoV4Router. Tokens from the legacy bonding-curve factory still trade on their curve.
 */
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
    const factory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!isDeployed(factory)) {
      throw new Error(`Factory contract not deployed on ${this.network.name}`);
    }

    const prebuyWei = parseInitialBuyWei(params.initialBuyAmountEth);
    const minPrebuyWei = this.network.launchConfigV2?.minPrebuyWei ?? 0n;
    if (prebuyWei < minPrebuyWei) {
      throw new Error(
        `Arc launches require a prebuy of at least ${formatEther(minPrebuyWei)} USDC.`,
      );
    }
    const buyTaxBps = taxPercentToBps(params.buyTaxPercent ?? 0);
    const sellTaxBps = taxPercentToBps(params.sellTaxPercent ?? 0);
    if (buyTaxBps === 0 && sellTaxBps === 0) {
      throw new Error('Arc tokens need a buy or sell tax above 0% (it is fixed forever).');
    }
    const split = revenueSplitToBps(params.revenueSplit);

    const hash = await walletClient.writeContract({
      address: factory,
      abi: launchpadV2FactoryArcAbi,
      functionName: 'launchToken',
      args: [
        {
          name: params.name,
          symbol: params.symbol,
          logo: params.logo,
          description: params.description,
          twitter: params.socials.twitter ?? '',
          telegram: params.socials.telegram ?? '',
          website: params.socials.website ?? '',
        },
        { buyTaxBps, sellTaxBps, ...split },
        params.minInitialTokensOut ?? 0n,
      ],
      value:
        this.network.launchConfig.launchFeeWei +
        (prebuyWei / USDC_WEI_PER_UNIT) * USDC_WEI_PER_UNIT,
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
      abi: launchpadV2FactoryArcAbi,
      logs: receipt.logs,
      eventName: 'TokenLaunchedV4',
    });
    if (!launch) return null;
    return {
      tokenAddress: launch.args.token,
      poolAddress: launch.args.poolId,
      // Taxes and split are applied atomically by the launch transaction.
      taxApplied: true,
    };
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
    return executeV4RouterSwap(
      this.network,
      { quote: this.network.contracts.weth, nativeScale: USDC_WEI_PER_UNIT },
      params,
      walletClient,
      publicClient,
      account,
    );
  }
}

export const arcChainAdapter = new ArcChainAdapter();
