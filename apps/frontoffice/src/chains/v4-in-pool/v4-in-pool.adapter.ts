import { formatEther, parseEventLogs, type PublicClient, type WalletClient } from 'viem';
import {
  launchpadV2FactoryArcAbi,
  nativeWeiPerQuoteUnit,
  type NetworkConfig,
} from '@goton/shared-types';
import { revenueSplitToBps, taxPercentToBps } from '@goton/math-sdk';
import type { ChainAdapter, ChainLaunchParams, ChainLaunchResult, ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { executeCurveSwap, isCurveTrade } from '../shared/curve-swap';
import { executeV4RouterSwap } from '../shared/v4-swap';
import { isDeployed, parseInitialBuyWei } from '../shared/utils';

/**
 * In-pool v4 chains (Arc Network): tokens launch straight into a Uniswap v4 pool (Argus portal
 * model). Taxes and the revenue split are fixed at launch by LaunchpadV2FactoryArc; trading goes
 * through GotonV4Router. Tokens from a legacy bonding-curve factory still trade on their curve.
 */
export class InPoolV4ChainAdapter implements ChainAdapter {
  readonly chainId: number;
  /** Native wei per unit of the quote ERC-20 (10^12 for 6-decimal USDC). */
  private readonly quoteUnit: bigint;

  constructor(readonly network: NetworkConfig) {
    this.chainId = network.chainId;
    this.quoteUnit = nativeWeiPerQuoteUnit(network);
  }

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
        `${this.network.name} launches require a prebuy of at least ${formatEther(minPrebuyWei)} ${this.network.nativeCurrency.symbol}.`,
      );
    }
    const buyTaxBps = taxPercentToBps(params.buyTaxPercent ?? 0);
    const sellTaxBps = taxPercentToBps(params.sellTaxPercent ?? 0);
    if (buyTaxBps === 0 && sellTaxBps === 0) {
      throw new Error(
        `${this.network.name} tokens need a buy or sell tax above 0% (it is fixed forever).`,
      );
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
      value: this.network.launchConfig.launchFeeWei + (prebuyWei / this.quoteUnit) * this.quoteUnit,
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
      splitApplied: true,
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
      { quote: this.network.contracts.weth, nativeScale: this.quoteUnit },
      params,
      walletClient,
      publicClient,
      account,
    );
  }
}
