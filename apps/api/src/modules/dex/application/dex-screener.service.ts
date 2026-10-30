import type { LaunchedTokenEntity, NetworkConfig, TradeEventEntity } from '@goton/shared-types';
import { AppError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import type { ChainRegistryPort, IChainService } from '../../chains';
import type { TokenStorePort } from '../../tokens/domain/ports/token-store.port';
import type { TradeStorePort } from '../../tokens/domain/ports/trade-store.port';
import { findAllTokens } from '../../tokens/application/all-tokens';
import { isCurvePair, parseAssetId, parsePairId } from '../domain/dex-pair';

/** Most swap events one /events request returns; a larger range must be split. */
const MAX_EVENTS = 5000;

type DexStore = Pick<
  TokenStorePort,
  'findByAddress' | 'findAll' | 'findByPoolAddress' | 'getLastIndexedBlock'
> &
  Pick<TradeStorePort, 'getTradesInBlockRange'>;

/** What the DEX Screener Adapter endpoints read for one chain. */
export class DexScreenerService {
  constructor(
    private readonly repository: DexStore,
    private readonly chainRegistry: ChainRegistryPort,
  ) {}

  /**
   * The indexer's persisted cursor and its block time, not the chain head: /events must already
   * hold every event up to the block reported here.
   */
  async latestBlock(
    chain: IChainService,
  ): Promise<{ blockNumber: bigint; blockTimestamp: number }> {
    const blockNumber = (await this.repository.getLastIndexedBlock?.(chain.network.name)) ?? 0n;
    if (blockNumber <= 0n) {
      throw new AppError('NOT_READY', 'The indexer has not stored a block yet', 503);
    }
    try {
      const block = await chain.client.getBlock({ blockNumber });
      return { blockNumber, blockTimestamp: Number(block.timestamp) };
    } catch {
      throw new AppError('UPSTREAM_ERROR', 'Could not read the block timestamp', 502);
    }
  }

  /** The token with this asset id on `network`, or 'quote' for the network's quote asset. */
  async asset(network: NetworkConfig, id: string): Promise<LaunchedTokenEntity | 'quote'> {
    const assetId = parseAssetId(id);
    if (!assetId) throw new ValidationError('id must be a 0x contract address', 'BAD_REQUEST');
    if (assetId.toLowerCase() === network.contracts.weth.toLowerCase()) return 'quote';
    const token = await this.repository.findByAddress(assetId);
    if (!token || !this.isOn(network, token)) throw new NotFoundError('Asset not found');
    return token;
  }

  /** The token trading in pair `id` on `network`, with the pair id as DEX Screener spells it. */
  async pair(
    network: NetworkConfig,
    id: string,
  ): Promise<{ token: LaunchedTokenEntity; pairId: string }> {
    const pairId = parsePairId(id);
    if (!pairId) {
      throw new ValidationError(
        'id must be a bonding curve address (0x + 40 hex) or a v4 poolId (0x + 64 hex)',
        'BAD_REQUEST',
      );
    }
    // The current pair (curve, or v4 pool once graduated), else a graduated token's old curve.
    const token =
      (await this.repository.findByPoolAddress?.(pairId as `0x${string}`)) ??
      (parseAssetId(pairId)
        ? ((await findAllTokens(this.repository)).find((t) => isCurvePair(t, pairId)) ?? null)
        : null);
    if (!token || !this.isOn(network, token)) throw new NotFoundError('Pair not found');
    return { token, pairId };
  }

  /** Trades of `network`'s tokens in [fromBlock, toBlock], optionally of one pair. */
  async events(
    network: NetworkConfig,
    fromBlock: string,
    toBlock: string,
    pairFilter: string | null,
  ): Promise<TradeEventEntity[]> {
    if (!/^\d+$/.test(fromBlock) || !/^\d+$/.test(toBlock) || BigInt(fromBlock) > BigInt(toBlock)) {
      throw new ValidationError(
        'fromBlock and toBlock are required integers, fromBlock <= toBlock',
        'INVALID_PARAM',
      );
    }
    const pairId = pairFilter ? parsePairId(pairFilter) : null;
    if (pairFilter && !pairId) throw new ValidationError('Invalid pair id', 'BAD_REQUEST');
    const trades =
      (await this.repository.getTradesInBlockRange?.(
        BigInt(fromBlock),
        BigInt(toBlock),
        MAX_EVENTS + 1,
      )) ?? [];
    // Each block is indexed once: a truncated range would lose events, so ask for a smaller one.
    if (trades.length > MAX_EVENTS) {
      throw new AppError(
        'RANGE_TOO_LARGE',
        `More than ${MAX_EVENTS} events; use a smaller range`,
        413,
      );
    }
    const tokens = new Map<string, LaunchedTokenEntity | null>();
    const kept: TradeEventEntity[] = [];
    for (const trade of trades) {
      const key = trade.tokenAddress.toLowerCase();
      if (!tokens.has(key)) {
        tokens.set(key, await this.repository.findByAddress(trade.tokenAddress));
      }
      const token = tokens.get(key);
      if (!token || !this.isOn(network, token)) continue;
      if (pairId && parsePairId(trade.poolAddress) !== pairId) continue;
      kept.push(trade);
    }
    return kept;
  }

  private isOn(network: NetworkConfig, token: LaunchedTokenEntity): boolean {
    return this.chainRegistry.resolveForToken(token).network.chainId === network.chainId;
  }
}
