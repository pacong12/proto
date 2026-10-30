import { decodeEventLog, parseAbiItem, type Address } from 'viem';
import {
  bondingCurveAbi,
  type LaunchedTokenEntity,
  type TradeEventEntity,
} from '@goton/shared-types';
import type { ChainRegistry } from '../../../chains';
import type { CachePort } from '../../../../core/ports/cache.port';
import type { LoggerPort } from '../../../../core/ports/logger.port';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import type { EventPollerService } from './event-poller.service';

const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
);

/**
 * Tokens can enter the database after the live poller has passed their first trades (found on a
 * page visit, or synced late). Their earlier curve trades are re-indexed in the background, from
 * the launch block when known, otherwise over TRADE_BACKFILL_BLOCKS (default 4M blocks, about 12
 * days on Robinhood Chain).
 */
const TRADE_BACKFILL_BLOCKS = BigInt(process.env.TRADE_BACKFILL_BLOCKS || '4000000');

/** Brings trades into the index that the live poller missed or has not reached yet. */
export class TradeSyncService {
  constructor(
    private readonly repository: TokenRepositoryPort,
    private readonly cache: CachePort,
    private readonly chainRegistry: ChainRegistry,
    private readonly pollers: ReadonlyMap<number, EventPollerService>,
    private readonly logger: LoggerPort,
  ) {}

  scheduleBackfill(token: LaunchedTokenEntity, fromBlock?: bigint): void {
    if (token.version !== 'v2' || process.env.NODE_ENV === 'test') return;
    const chain = this.chainRegistry.resolveForToken(token);
    const poller = this.pollers.get(chain.chainId)!;
    void (async () => {
      const head = await chain.client.getBlockNumber();
      const from = fromBlock ?? (head > TRADE_BACKFILL_BLOCKS ? head - TRADE_BACKFILL_BLOCKS : 0n);
      const found = await poller.backfillCurveTrades(token, from);
      if (found > 0)
        this.logger.info(`[Backfill] ${found} trade(s) for ${token.symbol} ${token.address}`);
    })().catch((e) =>
      this.logger.warn('[Backfill] curve trade backfill failed', {
        error: { name: (e as Error).name, message: (e as Error).message },
      }),
    );
  }

  /** Indexes the curve trades of a transaction the app just sent, before the poller reaches it. */
  async indexFromReceipt(txHash: `0x${string}`, tokenAddress: `0x${string}`): Promise<void> {
    const token = await this.repository.findByAddress(tokenAddress);
    if (!token) return;

    const chain = this.chainRegistry.resolveForToken(token);
    const client = chain.client;
    const quotePriceUsd = await chain.getQuotePriceUsd();

    const receipt = await client.getTransactionReceipt({ hash: txHash });
    if (!receipt || receipt.status !== 'success') return;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: [TRADE_EVENT],
          data: log.data,
          topics: log.topics,
        });
        const { trader, isBuy, ethAmount, tokenAmount } = decoded.args as {
          trader: Address;
          isBuy: boolean;
          ethAmount: bigint;
          tokenAmount: bigint;
        };
        if (ethAmount === undefined || tokenAmount === undefined) continue;

        const ethAmountNum = Number(ethAmount) / 1e18;
        const tokenAmountNum = Number(tokenAmount) / 1e18;

        let priceUsd = 0;
        if (token.version === 'v2') {
          const curveTarget = (token.curveAddress || log.address) as Address;
          try {
            const [vEth, vToken] = await Promise.all([
              client.readContract({
                address: curveTarget,
                abi: bondingCurveAbi,
                functionName: 'virtualEthReserve',
              }) as Promise<bigint>,
              client.readContract({
                address: curveTarget,
                abi: bondingCurveAbi,
                functionName: 'virtualTokenReserve',
              }) as Promise<bigint>,
            ]);
            if (vToken > 0n) {
              priceUsd = (Number(vEth) / Number(vToken)) * quotePriceUsd;
            }
          } catch {
            // fallback
          }
        }

        if (priceUsd <= 0) {
          const priceNative = tokenAmountNum > 0 ? ethAmountNum / tokenAmountNum : 0;
          priceUsd = priceNative * quotePriceUsd;
        }

        let timestamp = Date.now();
        try {
          const block = await client.getBlock({ blockNumber: receipt.blockNumber });
          timestamp = Number(block.timestamp) * 1000;
        } catch {
          timestamp = Date.now();
        }

        const trade: TradeEventEntity = {
          id: `${receipt.transactionHash}-${log.logIndex}`,
          tokenAddress: token.address,
          poolAddress: token.poolAddress,
          trader,
          isBuy,
          tokenAmount: tokenAmountNum.toFixed(4),
          wethAmount: ethAmountNum.toFixed(6),
          priceUsd,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.transactionHash,
          timestamp,
        };

        await this.repository.saveTrade(trade);
        // Invalidate caches so next poll immediately gets fresh data after a new trade
        await Promise.allSettled([
          this.cache.del(`token:detail:${tokenAddress.toLowerCase()}`),
          this.cache.delPrefix(`token:holders:${tokenAddress.toLowerCase()}`),
        ]);
        if (token.version === 'v2' && priceUsd > 0) {
          const mkt = await this.repository.getMarketData(token.address);
          if (mkt) {
            const supplyTokens = token.totalSupply
              ? Number(BigInt(token.totalSupply) / 10n ** BigInt(token.decimals || 18))
              : 1_000_000_000;
            await this.repository.saveMarketData({
              ...mkt,
              priceUsd,
              priceInWeth: priceUsd / quotePriceUsd,
              marketCapUsd: priceUsd * supplyTokens,
              fdvUsd: priceUsd * supplyTokens,
            });
            // Invalidate cached detail so price update is visible on next SSE/poll cycle
            await this.cache.del(`token:detail:${tokenAddress.toLowerCase()}`);
          }
        }
      } catch {
        // not a trade event
      }
    }
  }
}
