import type { PublicClient, WalletClient } from 'viem';
import {
  UNDEPLOYED,
  protoFeeSplitterAbi,
  protoV4BuybackAbi,
  protoV4PoolKeyFor,
  resolveFeeSplitter,
  type LaunchedTokenEntity,
  type NetworkConfig,
} from '@proto/shared-types';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

/** A pending keeper transaction older than this is replaced (DR-03). */
const STUCK_AFTER_MS = 5 * 60_000;
/** Fee multiplier for replacements; nodes require at least +10%. */
const REPLACEMENT_FEE_BUMP = 150n;

export interface V4BuybackResult {
  token: `0x${string}`;
  executed: boolean;
  reason?: string;
  txHash?: `0x${string}`;
}

/**
 * Triggers ProtoV4Buyback for every v4 pool on a chain whose burn share is waiting.
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
    if (!buyback || !this.walletClient) return [];
    const [account] = await this.walletClient.getAddresses();
    if (!account) return [];
    if (await this.hasPendingTransaction(account)) return [];

    const tokens = (await this.repository.findAll(500, 0)).filter((t) => this.isV4Token(t));
    const results: V4BuybackResult[] = [];
    for (const token of tokens) {
      const result = await this.tryBuyback(buyback, account, token.address);
      results.push(result);
      if (result.reason === 'Receipt pending') break;
    }
    return results;
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
          abi: protoFeeSplitterAbi,
          functionName: 'buybackAccrued',
        }),
        this.publicClient.readContract({
          address: buyback,
          abi: protoV4BuybackAbi,
          functionName: 'pending',
          args: [token],
        }),
      ]);
      if (accrued + pending <= this.minQuote) {
        return { token, executed: false, reason: 'Nothing worth buying back' };
      }

      const { result, request } = await this.publicClient.simulateContract({
        address: buyback,
        abi: protoV4BuybackAbi,
        functionName: 'buyback',
        args: [key],
        account,
      });
      if (result[0] === 0n) {
        return { token, executed: false, reason: 'Spot price outside the TWAP guard' };
      }
      const txHash = await this.walletClient!.writeContract(request);
      // Wait for inclusion so the next token's transaction never stacks behind this one.
      try {
        await this.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
      } catch {
        // Still pending: the next cycle's nonce check waits for it (or replaces it).
        return { token, executed: true, txHash, reason: 'Receipt pending' };
      }
      return { token, executed: true, txHash };
    } catch (e) {
      // OracleNotReady and transient RPC errors land here; the next cycle retries.
      return { token, executed: false, reason: (e as Error).message.split('\n')[0] };
    }
  }
}
