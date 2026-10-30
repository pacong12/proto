import { PublicClient } from 'viem';
import { DEFAULT_NETWORK, type LaunchedTokenEntity, type NetworkConfig } from '@goton/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import type { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from '../../application/use-cases/calculate-pricing.use-case';
import { MAX_BLOCK_RANGE, CONFIRMATIONS, MAX_RANGE_ATTEMPTS } from './indexer-events';
import { IndexerContext } from './indexer-context';
import { LaunchIndexer } from './launch.indexer';
import { TradeIndexer } from './trade.indexer';
import { HolderIndexer } from './holder.indexer';
import { LimitOrderIndexer } from './limit-order.indexer';

export {
  TOKEN_LAUNCHED_V2_EVENT,
  TOKEN_LAUNCHED_V2_STANDARD_EVENT,
  TOKEN_LAUNCHED_V4_EVENT,
  TOKEN_GRADUATED_EVENT,
} from './indexer-events';

/**
 * Indexes one chain: advances a persisted block cursor in bounded ranges, retries a failing
 * range (skipping it after MAX_RANGE_ATTEMPTS), and hands each range to the indexers.
 */
export class EventPollerService {
  readonly context: IndexerContext;
  readonly launches: LaunchIndexer;
  readonly trades: TradeIndexer;
  readonly holders: HolderIndexer;
  readonly limitOrders: LimitOrderIndexer;

  constructor(
    client: PublicClient,
    tokenRepository: TokenRepositoryPort,
    chainIndexer: ChainIndexerPort,
    calculatePricing: CalculatePricingUseCase,
    priceFeed: PriceFeedPort,
    network: NetworkConfig = DEFAULT_NETWORK,
  ) {
    this.context = new IndexerContext({
      client,
      tokenRepository,
      chainIndexer,
      calculatePricing,
      priceFeed,
      network,
    });
    this.launches = new LaunchIndexer(this.context);
    this.trades = new TradeIndexer(this.context);
    this.holders = new HolderIndexer(this.context);
    this.limitOrders = new LimitOrderIndexer(this.context);
  }

  /** Pause used by backfills; tests replace it. */
  get sleep(): (ms: number) => Promise<void> {
    return this.context.sleep;
  }
  set sleep(fn: (ms: number) => Promise<void>) {
    this.context.sleep = fn;
  }

  /** Resolves once the holder history being read in the background is done. */
  holderBackfillSettled(): Promise<void> {
    return this.holders.holderBackfillSettled();
  }

  /** Reads a token's Transfer history from its launch block and records every holder's balance. */
  backfillHolders(token: LaunchedTokenEntity, to: bigint): Promise<void> {
    return this.holders.backfillHolders(token, to);
  }

  /** Re-indexes one curve's trades over [from, to] (default: up to the live cursor). */
  backfillCurveTrades(token: LaunchedTokenEntity, from: bigint, to?: bigint): Promise<number> {
    return this.trades.backfillCurveTrades(token, from, to);
  }

  /** True when the last cycle stopped short of the chain head; the caller polls again at once. */
  isBehind = false;

  private failedRangeStart: bigint | null = null;

  private rangeFailures = 0;

  async pollEvents(fromBlock?: bigint, toBlock?: bigint): Promise<number> {
    let currentBlock = 0n;
    try {
      // API-10: stay CONFIRMATIONS blocks behind the head so short reorgs never index dropped logs.
      currentBlock = toBlock ?? (await this.context.deps.client.getBlockNumber()) - CONFIRMATIONS;

      if (
        this.context.lastPolledBlock === 0n &&
        this.context.deps.tokenRepository.getLastIndexedBlock
      ) {
        try {
          const persisted = await this.context.deps.tokenRepository.getLastIndexedBlock(
            this.context.deps.network.name,
          );
          if (persisted && persisted > 0n) {
            this.context.lastPolledBlock = persisted;
          }
        } catch {
          // fallback to live block
        }
      }

      const startBlock =
        fromBlock ??
        (this.context.lastPolledBlock > 0n
          ? this.context.lastPolledBlock + 1n
          : currentBlock - MAX_BLOCK_RANGE);

      if (startBlock > currentBlock) return 0;

      // Sequential batching: process at most MAX_BLOCK_RANGE blocks per cycle to respect RPC limits.
      // Never drop or skip blocks; subsequent cycles continue catch-up until currentBlock is reached.
      const batchEnd =
        currentBlock - startBlock > MAX_BLOCK_RANGE ? startBlock + MAX_BLOCK_RANGE : currentBlock;

      const count = await this.indexRange(startBlock, batchEnd);

      // Advance and persist lastPolledBlock only on success so a failed cycle retries the same range.
      this.context.lastPolledBlock = batchEnd;
      this.isBehind = batchEnd < currentBlock;
      if (this.context.deps.tokenRepository.setLastIndexedBlock) {
        await this.context.deps.tokenRepository.setLastIndexedBlock(
          this.context.deps.network.name,
          batchEnd,
        );
      }
      return count;
    } catch (error) {
      // A range that keeps failing (e.g. one malformed log) must not stall indexing forever:
      // after MAX_RANGE_ATTEMPTS the range is skipped, loudly.
      const failedStart =
        fromBlock ?? (this.context.lastPolledBlock > 0n ? this.context.lastPolledBlock + 1n : 0n);
      this.rangeFailures = this.failedRangeStart === failedStart ? this.rangeFailures + 1 : 1;
      this.failedRangeStart = failedStart;
      if (
        this.rangeFailures >= MAX_RANGE_ATTEMPTS &&
        fromBlock === undefined &&
        currentBlock > 0n
      ) {
        const skipTo =
          currentBlock - failedStart > MAX_BLOCK_RANGE
            ? failedStart + MAX_BLOCK_RANGE
            : currentBlock;
        console.error(
          `[EventPoller:${this.context.deps.network.name}] skipping blocks ${failedStart}-${skipTo} after ${this.rangeFailures} failed attempts`,
        );
        this.context.lastPolledBlock = skipTo;
        this.rangeFailures = 0;
        void this.context.deps.tokenRepository.setLastIndexedBlock?.(
          this.context.deps.network.name,
          skipTo,
        );
      }
      const e = error as { code?: number; message?: string };
      if (e?.code === 429 || e?.message?.includes('Too Many Requests')) {
        console.warn(`[EventPoller:${this.context.deps.network.name}] RPC 429 — backing off`);
      } else {
        console.error(`[EventPoller:${this.context.deps.network.name}] pollEvents error:`, error);
      }
      // Do NOT advance lastPolledBlock on error; next cycle will retry from the same position.
      // Advancing on failure would permanently skip the failed block range.
      return 0;
    }
  }

  /**
   * Indexes launches, graduations and trades in [from, to] without moving the live cursor.
   * Used by the poller and by scripts/backfill-tokens.ts (DR-06); throws on RPC errors so the
   * caller can retry the same range.
   */
  async indexRange(from: bigint, to: bigint): Promise<number> {
    let count = 0;
    count += await this.launches.pollV1Launches(from, to);
    count += await this.launches.pollV2Launches(from, to);
    count += await this.launches.pollV4Launches(from, to);
    count += await this.launches.pollGraduations(from, to);
    count += await this.trades.pollV2Trades(from, to);
    count += await this.trades.pollV1Swaps(from, to);
    count += await this.trades.pollV4Swaps(from, to);
    count += await this.limitOrders.pollLimitOrders(from, to);
    count += await this.holders.pollTransfers(from, to);
    return count;
  }
}
