import type { PublicClient, WalletClient } from 'viem';
import {
  UNDEPLOYED,
  getChainAbis,
  gotonFeeSplitterAbi,
  gotonV4GraduatorAbi,
  launchpadV2FactoryArcAbi,
  gotonV4BuybackAbi,
  protoV4PoolKeyFor,
  resolveFeeSplitter,
  type LaunchedTokenEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { findAllTokens } from '../../application/all-tokens';
import { sendAndWait, sentResult } from './keeper-tx';

/** A pending keeper transaction older than this is replaced (DR-03). */
const STUCK_AFTER_MS = 5 * 60_000;
/** Fee multiplier for replacements; nodes require at least +10%. */
const REPLACEMENT_FEE_BUMP = 150n;

export interface V4BuybackResult {
  token: `0x${string}`;
  /** Defaults to 'buyback'. */
  action?: 'buyback' | 'collectFees' | 'releaseProtocolFees' | 'releaseLiquidityFees';
  executed: boolean;
  reason?: string;
  txHash?: `0x${string}`;
}

/** Splitter shares that accrue during swaps and are paid out by a permissionless call (ARC-01). */
const FEE_RELEASES = [
  { action: 'releaseProtocolFees', accrued: 'protocolAccrued' },
  { action: 'releaseLiquidityFees', accrued: 'liquidityAccrued' },
] as const;

/**
 * Collects each v4 pool's LP fees into its splitter (holder dividends, creator, burn and protocol
 * shares only exist once they are collected), triggers GotonV4Buyback for every pool whose burn
 * share is waiting, and pays the splitters' accrued protocol and liquidity shares to the treasury
 * and liquidity vault.
 * The contract enforces the TWAP price guard itself, so the keeper only decides *when* to call;
 * it never supplies a price or minimum (red-team "Echo"). Each call is simulated first so tokens
 * whose oracle is not ready, or whose spot price is outside the guard, cost no gas.
 */
export class V4BuybackKeeperService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly repository: TokenRepositoryPort,
    private readonly network: NetworkConfig,
    /** Minimum quote (smallest units) worth a transaction. */
    private readonly minQuote: bigint = 0n,
    private readonly now: () => number = Date.now,
  ) {}

  /** When the keeper first saw its account with an unmined transaction (DR-03). */
  private stuckSince: number | null = null;

  private get buyback(): `0x${string}` | null {
    const address = this.network.contracts.buyback;
    return address && address !== UNDEPLOYED ? address : null;
  }

  /** v4 tokens of this chain: in-pool launches and graduated curves (pool id stored as poolAddress). */
  private isV4Token(token: LaunchedTokenEntity): boolean {
    const onChain = token.chainId === undefined || token.chainId === this.network.chainId;
    return (
      onChain &&
      (token.version === 'v4' || (token.isGraduated === true && token.poolAddress.length === 66))
    );
  }

  async runOnce(): Promise<V4BuybackResult[]> {
    const buyback = this.buyback;
    if (!this.walletClient) return [];
    const [account] = await this.walletClient.getAddresses();
    if (!account) return [];
    if (await this.hasPendingTransaction(account)) return [];

    const tokens = (await findAllTokens(this.repository)).filter((t) => this.isV4Token(t));
    const results: V4BuybackResult[] = [];
    for (const token of tokens) {
      const collected = await this.tryCollectFees(account, token.address);
      if (collected) {
        results.push(collected);
        if (collected.reason === 'Receipt pending') return results;
      }
      if (buyback) {
        const result = await this.tryBuyback(buyback, account, token.address);
        results.push(result);
        if (result.reason === 'Receipt pending') return results;
      }
      for (const release of FEE_RELEASES) {
        const result = await this.tryRelease(account, token.address, release);
        if (!result) continue;
        results.push(result);
        if (result.reason === 'Receipt pending') return results;
      }
    }
    return results;
  }

  /**
   * Collects a pool's LP fees: the quote side goes to the token's splitter, the token side is
   * burned. The locked positions are held by the graduator (curve launches) or the factory
   * (in-pool launches on Arc); both expose a permissionless collectFees. Returns null when the
   * quote fees are not worth a transaction (KEEPER_MIN_QUOTE_<SLUG>).
   */
  private async tryCollectFees(
    account: `0x${string}`,
    token: `0x${string}`,
  ): Promise<V4BuybackResult | null> {
    const graduated = Boolean(getChainAbis(this.network.chainId).graduator);
    const holder = graduated
      ? this.network.contracts.graduator
      : (this.network.contracts.factoryV2 ?? this.network.contracts.factory);
    if (!holder || holder === UNDEPLOYED) return null;
    try {
      const { result, request } = await this.publicClient.simulateContract({
        address: holder,
        abi: graduated ? gotonV4GraduatorAbi : launchpadV2FactoryArcAbi,
        functionName: 'collectFees',
        args: [token],
        account,
      });
      const [quoteFees] = result as readonly [bigint, bigint];
      if (quoteFees <= this.minQuote) return null;
      const sent = await sendAndWait(this.publicClient, this.walletClient!, request);
      return { token, action: 'collectFees', ...sentResult(sent) };
    } catch (e) {
      // UnknownToken for pools the holder does not own, and transient RPC errors.
      return {
        token,
        action: 'collectFees',
        executed: false,
        reason: (e as Error).message.split('\n')[0],
      };
    }
  }

  /**
   * Pays out one accrued splitter share. Returns null when there is nothing to do, including for
   * splitters deployed before the pull model, which have no accrued getter.
   */
  private async tryRelease(
    account: `0x${string}`,
    token: `0x${string}`,
    release: (typeof FEE_RELEASES)[number],
  ): Promise<V4BuybackResult | null> {
    try {
      const splitter = await resolveFeeSplitter(this.publicClient, this.network, token);
      if (!splitter) return null;
      const accrued: unknown = await this.publicClient
        .readContract({
          address: splitter.address,
          abi: gotonFeeSplitterAbi,
          functionName: release.accrued,
        })
        .catch(() => null);
      if (typeof accrued !== 'bigint' || accrued <= this.minQuote) return null;

      const { request } = await this.publicClient.simulateContract({
        address: splitter.address,
        abi: gotonFeeSplitterAbi,
        functionName: release.action,
        account,
      });
      const sent = await sendAndWait(this.publicClient, this.walletClient!, request);
      return { token, action: release.action, ...sentResult(sent) };
    } catch (e) {
      // A recipient that rejects payment (e.g. USDC-blocklisted) fails here, never in a swap.
      return {
        token,
        action: release.action,
        executed: false,
        reason: (e as Error).message.split('\n')[0],
      };
    }
  }

  /**
   * DR-03: never queue new transactions behind an unmined one. Each cycle waits for the previous
   * transaction; if it stays pending for STUCK_AFTER_MS, a 0-value self-transfer with bumped fees
   * replaces it at the same nonce so the queue unblocks.
   */
  private async hasPendingTransaction(account: `0x${string}`): Promise<boolean> {
    const [mined, pending] = await Promise.all([
      this.publicClient.getTransactionCount({ address: account, blockTag: 'latest' }),
      this.publicClient.getTransactionCount({ address: account, blockTag: 'pending' }),
    ]);
    if (pending <= mined) {
      this.stuckSince = null;
      return false;
    }
    const now = this.now();
    if (this.stuckSince === null) {
      this.stuckSince = now;
      return true;
    }
    if (now - this.stuckSince < STUCK_AFTER_MS) return true;

    const fees = await this.publicClient.estimateFeesPerGas();
    const bump = (v: bigint | undefined) => ((v ?? 0n) * REPLACEMENT_FEE_BUMP) / 100n;
    await this.walletClient!.sendTransaction({
      account,
      chain: this.walletClient!.chain,
      to: account,
      value: 0n,
      nonce: mined,
      maxFeePerGas: bump(fees.maxFeePerGas),
      maxPriorityFeePerGas: bump(fees.maxPriorityFeePerGas),
    });
    // Give the replacement a full window before trying again.
    this.stuckSince = now;
    return true;
  }

  private async tryBuyback(
    buyback: `0x${string}`,
    account: `0x${string}`,
    token: `0x${string}`,
  ): Promise<V4BuybackResult> {
    try {
      const key = protoV4PoolKeyFor(this.network, token);
      const splitter = await resolveFeeSplitter(this.publicClient, this.network, token);
      if (!key || !splitter) return { token, executed: false, reason: 'No pool or splitter' };

      const [accrued, pending] = await Promise.all([
        this.publicClient.readContract({
          address: splitter.address,
          abi: gotonFeeSplitterAbi,
          functionName: 'buybackAccrued',
        }),
        this.publicClient.readContract({
          address: buyback,
          abi: gotonV4BuybackAbi,
          functionName: 'pending',
          args: [token],
        }),
      ]);
      if (accrued + pending <= this.minQuote) {
        return { token, executed: false, reason: 'Nothing worth buying back' };
      }

      const { result, request } = await this.publicClient.simulateContract({
        address: buyback,
        abi: gotonV4BuybackAbi,
        functionName: 'buyback',
        args: [key],
        account,
      });
      if (result[0] === 0n) {
        return { token, executed: false, reason: 'Spot price outside the TWAP guard' };
      }
      const sent = await sendAndWait(this.publicClient, this.walletClient!, request);
      return { token, ...sentResult(sent) };
    } catch (e) {
      // OracleNotReady and transient RPC errors land here; the next cycle retries.
      return { token, executed: false, reason: (e as Error).message.split('\n')[0] };
    }
  }
}
