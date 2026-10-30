import {
  getAbiItem,
  parseEventLogs,
  toFunctionSelector,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { launchpadTokenAbi, launchpadV2FactoryAbi, gotonV4GraduatorAbi } from '@goton/shared-types';
import { revenueSplitToBps, taxPercentToBps } from '@goton/math-sdk';
import type { ChainLaunchParams, ChainLaunchResult, ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { LaunchpadChainAdapter } from '../shared/base.adapter';
import { isDeployed, parseInitialBuyWei } from '../shared/utils';

const NATIVE_ETH = '0x0000000000000000000000000000000000000000' as const;

// PUSH4 <selector>, as the factory's function dispatcher has it.
const LAUNCH_WITH_CONFIG_DISPATCH = `63${toFunctionSelector(
  getAbiItem({ abi: launchpadV2FactoryAbi, name: 'launchTokenV2WithConfig' }),
).slice(2)}`;
const launchConfigSupport = new Map<string, boolean>();

/**
 * Factories deployed before the launch release have no `launchTokenV2WithConfig`; a call to it
 * reverts without data. Those factories still take the tax and split as follow-up transactions.
 * When the bytecode cannot be read, the configured launch is assumed.
 */
async function factoryTakesLaunchConfig(
  publicClient: PublicClient,
  factory: `0x${string}`,
): Promise<boolean> {
  const known = launchConfigSupport.get(factory);
  if (known !== undefined) return known;
  try {
    const code = await publicClient.getCode({ address: factory });
    if (!code || code === '0x') return true;
    const supported = code.toLowerCase().includes(LAUNCH_WITH_CONFIG_DISPATCH);
    launchConfigSupport.set(factory, supported);
    return supported;
  } catch {
    return true;
  }
}

/**
 * Bonding-curve chains (Robinhood Chain): a curve, then permissionless graduation into a locked
 * native-quote Uniswap v4 pool (GotonV4Graduator). Post-graduation trades go through GotonV4Router.
 */
export class BondingCurveChainAdapter extends LaunchpadChainAdapter {
  /** Graduated pools pair the token with native ETH. */
  protected readonly poolQuote = { quote: NATIVE_ETH, nativeScale: 1n };

  async launchToken(
    params: ChainLaunchParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
    onHashEmitted?: (hash: `0x${string}`) => void,
  ): Promise<ChainLaunchResult | null> {
    const factory = this.requireFactory();
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
    // The tax and the LP-fee split go into the launch transaction itself: both lock at the first
    // third-party buy (and the tax also once the token's short launch window ends), so follow-up
    // transactions the creator still has to sign race every early buyer.
    const buyTaxBps = taxPercentToBps(params.buyTaxPercent ?? 0);
    const sellTaxBps = taxPercentToBps(params.sellTaxPercent ?? 0);
    const withSplit = Boolean(params.revenueSplit) && isDeployed(this.network.contracts.graduator);
    const split = withSplit
      ? revenueSplitToBps(params.revenueSplit)
      : { holdersBps: 0, burnBps: 0, creatorBps: 0, liquidityBps: 0 };
    const configured = buyTaxBps > 0 || sellTaxBps > 0 || withSplit;
    const inLaunchTx = configured && (await factoryTakesLaunchConfig(publicClient, factory));
    const value = this.network.launchConfig.launchFeeWei + initialBuyWei;
    const hash = inLaunchTx
      ? await walletClient.writeContract({
          address: factory,
          abi: launchpadV2FactoryAbi,
          functionName: 'launchTokenV2WithConfig',
          args: [
            ...launchArgs,
            { buyTaxBps, sellTaxBps, taxRecipient: params.creatorTaxWallet ?? account },
            split,
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

    const receipt = await this.confirmLaunch(hash, walletClient, publicClient, onHashEmitted);
    if (!receipt) return null;

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
      // Both were part of the launch transaction, which was mined successfully.
      taxApplied: true,
      splitApplied: !params.revenueSplit || withSplit,
    };
    if (!configured || inLaunchTx) return result;

    // Older factory: tax and split follow the launch, before any third-party buy locks them.
    if (buyTaxBps > 0 || sellTaxBps > 0) {
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
        console.warn('[BondingCurveChainAdapter] Initial tax was not applied:', err);
        result.taxApplied = false;
      }
    }
    if (withSplit && params.revenueSplit) {
      result.splitApplied = await this.applyRevenueSplit(
        result.tokenAddress,
        params.revenueSplit,
        walletClient,
        publicClient,
        account,
      );
    }
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
      console.warn('[BondingCurveChainAdapter] Revenue split was not applied:', err);
      return false;
    }
  }

  /**
   * Graduation is permissionless: if the curve finished but nobody has moved its liquidity into
   * the v4 pool yet, the first post-graduation trader does it (factory.graduate) before swapping.
   */
  protected override async beforePoolSwap(
    params: ChainSwapParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<void> {
    const { graduator } = this.network.contracts;
    const { factory } = this;
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
}
