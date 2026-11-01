import { PublicClient } from 'viem';
import { type NetworkConfig } from '@goton/shared-types';
import { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import type { ChainIndexerPort } from '../../domain/ports/chain.indexer.port';
import { PriceFeedPort } from '../../domain/ports/price-feed.port';
import { CalculatePricingUseCase } from '../../application/use-cases/calculate-pricing.use-case';
import { BACKFILL_CHUNK, BACKFILL_RETRY_DELAYS_MS } from './indexer-events';

/** What every indexer of one chain shares: its clients and stores, and backfill pacing. */
export interface IndexerDeps {
  client: PublicClient;
  tokenRepository: TokenRepositoryPort;
  chainIndexer: ChainIndexerPort;
  calculatePricing: CalculatePricingUseCase;
  priceFeed: PriceFeedPort;
  network: NetworkConfig;
}

/** Shared state of one chain's indexers: pacing of history backfills and the live cursor. */
export class IndexerContext {
  /** Where the live poller has indexed up to (0 before its first cycle). */
  lastPolledBlock = 0n;
  private lastBackfillRequestAt = 0;

  constructor(readonly deps: IndexerDeps) {}

  /** Waits between backfill requests and retries; tests replace it. */
  sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  /** Runs one history request, paced for the chain's RPC and retried when it is rate limited. */
  async withBackfillRetry<T>(request: () => Promise<T>): Promise<T> {
    const interval = this.deps.network.backfillRequestIntervalMs ?? 0;
    for (let attempt = 0; ; attempt += 1) {
      const wait = this.lastBackfillRequestAt + interval - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.lastBackfillRequestAt = Date.now();
      try {
        return await request();
      } catch (e) {
        if (attempt >= BACKFILL_RETRY_DELAYS_MS.length) throw e;
        await this.sleep(BACKFILL_RETRY_DELAYS_MS[attempt]!);
      }
    }
  }

  /** eth_getLogs block span of one backfill request, capped by the chain's RPC limit. */
  get backfillChunk(): bigint {
    const cap = this.deps.network.maxLogBlockRange;
    return cap && BigInt(cap) < BACKFILL_CHUNK ? BigInt(cap) : BACKFILL_CHUNK;
  }
}

/** Base of the indexers: the shared context under the names the indexing code uses. */
export abstract class ChainIndexerPart {
  constructor(protected readonly context: IndexerContext) {}

  protected get client(): PublicClient {
    return this.context.deps.client;
  }
  protected get tokenRepository(): TokenRepositoryPort {
    return this.context.deps.tokenRepository;
  }
  protected get chainIndexer(): ChainIndexerPort {
    return this.context.deps.chainIndexer;
  }
  protected get calculatePricing(): CalculatePricingUseCase {
    return this.context.deps.calculatePricing;
  }
  protected get priceFeed(): PriceFeedPort {
    return this.context.deps.priceFeed;
  }
  protected get network(): NetworkConfig {
    return this.context.deps.network;
  }
  protected get lastPolledBlock(): bigint {
    return this.context.lastPolledBlock;
  }
  protected get backfillChunk(): bigint {
    return this.context.backfillChunk;
  }
  protected withBackfillRetry<T>(request: () => Promise<T>): Promise<T> {
    return this.context.withBackfillRetry(request);
  }
}
