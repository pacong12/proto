import type { PublicClient, TransactionReceipt, WalletClient } from 'viem';
import type { NetworkConfig } from '@goton/shared-types';
import type { ChainAdapter, ChainLaunchParams, ChainLaunchResult, ChainSwapParams } from '../types';
import { waitForReceiptWithFallback } from '../../lib/viem-client';
import { executeCurveSwap, isCurveTrade } from './curve-swap';
import { executeV4RouterSwap, type V4QuoteConfig } from './v4-swap';
import { isDeployed } from './utils';

/**
 * What every launch model shares: the network's factory, waiting for the launch transaction,
 * and swaps (a token still on a bonding curve trades there, any other in its v4 pool).
 * Launch models supply the launch itself and the quote currency of their pools.
 */
export abstract class LaunchpadChainAdapter implements ChainAdapter {
  readonly chainId: number;
  /** The quote currency of this model's v4 pools, as GotonV4Router is paid. */
  protected abstract readonly poolQuote: V4QuoteConfig;

  constructor(readonly network: NetworkConfig) {
    this.chainId = network.chainId;
  }

  abstract launchToken(
    params: ChainLaunchParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
    onHashEmitted?: (hash: `0x${string}`) => void,
  ): Promise<ChainLaunchResult | null>;

  async executeSwap(
    params: ChainSwapParams,
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: `0x${string}`,
  ): Promise<string | null> {
    if (isCurveTrade(params)) {
      return executeCurveSwap(params, walletClient, publicClient, account);
    }
    await this.beforePoolSwap(params, walletClient, publicClient, account);
    return executeV4RouterSwap(
      this.network,
      this.poolQuote,
      params,
      walletClient,
      publicClient,
      account,
    );
  }

  /** Runs before a pool swap; a model that must prepare the pool first overrides it. */
  protected async beforePoolSwap(
    _params: ChainSwapParams,
    _walletClient: WalletClient,
    _publicClient: PublicClient,
    _account: `0x${string}`,
  ): Promise<void> {}

  /** The launch factory address (UNDEPLOYED when this network has none). */
  protected get factory(): `0x${string}` {
    return this.network.contracts.factoryV2 ?? this.network.contracts.factory;
  }

  /** The launch factory; throws when it is not deployed on this network. */
  protected requireFactory(): `0x${string}` {
    const { factory } = this;
    if (!isDeployed(factory)) {
      throw new Error(`Factory contract not deployed on ${this.network.name}`);
    }
    return factory;
  }

  /**
   * Reports the launch hash and waits for its receipt. Null when the receipt never arrived;
   * throws when the transaction reverted.
   */
  protected async confirmLaunch(
    hash: `0x${string}`,
    walletClient: WalletClient,
    publicClient: PublicClient,
    onHashEmitted?: (hash: `0x${string}`) => void,
  ): Promise<TransactionReceipt | null> {
    onHashEmitted?.(hash);
    const receipt = await waitForReceiptWithFallback(publicClient, hash, walletClient);
    if (!receipt) return null;
    if (receipt.status === 'reverted') {
      throw new Error(
        `Transaction reverted on-chain. Hash: ${hash}. Block: ${receipt.blockNumber}.`,
      );
    }
    return receipt;
  }
}
