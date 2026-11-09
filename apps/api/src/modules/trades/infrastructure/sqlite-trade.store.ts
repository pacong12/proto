import type { Database } from 'bun:sqlite';
import type { SqliteDatabase } from '../../../core/sqlite/sqlite-database';
import type { TradeStorePort } from '../../../core/ports/trade-store.port';
import { TradeEventEntity, CandlestickEntity, chartPriceUsd } from '@goton/shared-types';
import type { TradeFlow } from '../../../core/ports/token.repository.port';
import {
  aggregateCandlesticks,
  chartEndTime,
  chartStartTime,
  computeHoldersDistribution,
  holdersFromBalances,
} from '../domain/services/token-aggregation.service';
import { POOL_HOLDERS, TradeRow, mapRowToTrade } from '../../../core/sqlite/sqlite-rows';
import type { TokenStorePort } from '../../../core/ports/token-store.port';

/** The most bars a gap-filled chart returns; older ones are cut. */
const CHART_MAX_CANDLES = 1000;

type CandleRow = Pick<TradeRow, 'timestamp' | 'priceUsd' | 'priceQuote' | 'wethAmount'>;

/** Indexed trades and what is derived from them (candles, flow, holders, positions). */
export class SqliteTradeStore implements TradeStorePort {
  private readonly db: Database;

  constructor(
    database: SqliteDatabase,
    private readonly tokens: TokenStorePort,
  ) {
    this.db = database.db;
  }

  async getTradeFlow(tokenAddress: `0x${string}`, sinceMs: number): Promise<TradeFlow> {
    const rows = this.db
      .prepare(
        `SELECT isBuy, SUM(CAST(wethAmount AS REAL)) AS quote, COUNT(*) AS n,
                COUNT(DISTINCT LOWER(trader)) AS traders
         FROM trades WHERE tokenAddress = ? COLLATE NOCASE AND timestamp >= ?
         GROUP BY isBuy`,
      )
      .all(tokenAddress, sinceMs) as Array<{
      isBuy: number;
      quote: number;
      n: number;
      traders: number;
    }>;
    const buy = rows.find((r) => Number(r.isBuy) === 1);
    const sell = rows.find((r) => Number(r.isBuy) === 0);
    return {
      buyQuote: Number(buy?.quote ?? 0),
      sellQuote: Number(sell?.quote ?? 0),
      buys: Number(buy?.n ?? 0),
      sells: Number(sell?.n ?? 0),
      buyers: Number(buy?.traders ?? 0),
      sellers: Number(sell?.traders ?? 0),
    };
  }

  async saveTrade(trade: TradeEventEntity): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO trades (
        id, tokenAddress, poolAddress, trader, isBuy, tokenAmount,
        wethAmount, priceUsd, blockNumber, transactionHash, timestamp, priceQuote
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trade.id,
      trade.tokenAddress,
      trade.poolAddress,
      trade.trader,
      trade.isBuy ? 1 : 0,
      trade.tokenAmount,
      trade.wethAmount,
      trade.priceUsd,
      trade.blockNumber.toString(),
      trade.transactionHash,
      trade.timestamp,
      trade.priceQuote ?? null,
    );
  }

  async getTrades(
    tokenAddress: `0x${string}`,
    limit = 50,
    offset = 0,
  ): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE tokenAddress = ? COLLATE NOCASE
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(tokenAddress, limit, offset) as TradeRow[];
    return rows.map((row) => mapRowToTrade(row));
  }

  async getPriceAnchor(
    tokenAddress: `0x${string}`,
    cutoffMs: number,
  ): Promise<TradeEventEntity | null> {
    const row =
      (this.db
        .prepare(
          `SELECT * FROM trades WHERE tokenAddress = ? COLLATE NOCASE AND timestamp <= ?
           ORDER BY timestamp DESC, rowid DESC LIMIT 1`,
        )
        .get(tokenAddress, cutoffMs) as TradeRow | null) ??
      (this.db
        .prepare(
          `SELECT * FROM trades WHERE tokenAddress = ? COLLATE NOCASE
           ORDER BY timestamp ASC, rowid ASC LIMIT 1`,
        )
        .get(tokenAddress) as TradeRow | null);
    return row ? mapRowToTrade(row) : null;
  }

  async getCandlesticks(
    tokenAddress: `0x${string}`,
    resolutionSeconds = 60,
    fillGaps = false,
    quotePriceUsd?: number,
  ): Promise<CandlestickEntity[]> {
    const token = await this.tokens.findByAddress(tokenAddress);
    const mkt = await this.tokens.getMarketData(tokenAddress);
    const span = this.db
      .prepare(
        `SELECT MIN(timestamp) AS first, MAX(timestamp) AS last FROM trades
         WHERE tokenAddress = ? COLLATE NOCASE`,
      )
      .get(tokenAddress) as { first: number | null; last: number | null };
    const endTime = chartEndTime(span.last ?? undefined);
    // Gap-filled candles keep only the newest CHART_MAX_CANDLES bars, which open at the last
    // trade before them: read that window and that one trade, not every trade the token has.
    const bucketMs = resolutionSeconds * 1000;
    const windowStart = fillGaps
      ? Math.floor(endTime / bucketMs) * bucketMs - CHART_MAX_CANDLES * bucketMs
      : 0;
    const columns = 'timestamp, priceUsd, priceQuote, wethAmount';
    const opening = this.db
      .prepare(
        `SELECT ${columns} FROM trades
         WHERE tokenAddress = ? COLLATE NOCASE AND timestamp < ?
         ORDER BY timestamp DESC, rowid DESC LIMIT 1`,
      )
      .get(tokenAddress, windowStart) as CandleRow | null;
    const inWindow = this.db
      .prepare(
        `SELECT ${columns} FROM trades
         WHERE tokenAddress = ? COLLATE NOCASE AND timestamp >= ?
         ORDER BY timestamp ASC, rowid ASC`,
      )
      .all(tokenAddress, windowStart) as CandleRow[];
    const rows = (opening ? [opening, ...inWindow] : inWindow).map((row) => ({
      ...row,
      priceUsd: chartPriceUsd(
        { priceUsd: row.priceUsd, priceQuote: row.priceQuote ?? undefined },
        quotePriceUsd,
      ),
    }));
    return aggregateCandlesticks(rows, resolutionSeconds, {
      startTime: chartStartTime(token?.createdAt, span.first ?? undefined),
      endTime,
      fillGaps,
      maxCandles: CHART_MAX_CANDLES,
      fallbackPrice: mkt?.priceUsd || 0.0000042,
    });
  }

  async getHolders(
    tokenAddress: string,
    limit = 50,
  ): Promise<Array<{ address: string; balance: string; percent: number }>> {
    const token = await this.tokens.findByAddress(tokenAddress as `0x${string}`);
    const indexed = this.db
      .prepare(`SELECT 1 FROM holder_index WHERE token_address = ? COLLATE NOCASE`)
      .get(tokenAddress);
    if (indexed) {
      const balances = this.db
        .prepare(
          `SELECT holder, balance FROM token_balances WHERE token_address = ? COLLATE NOCASE`,
        )
        .all(tokenAddress) as Array<{ holder: string; balance: string }>;
      return holdersFromBalances(token, balances, limit, POOL_HOLDERS);
    }
    // Not indexed yet: an estimate from the newest trades (misses transfers and older trades).
    const trades = await this.getTrades(tokenAddress as `0x${string}`, 1000, 0);
    return computeHoldersDistribution(token, trades, limit);
  }

  async getRecentTrades(limit = 50): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as TradeRow[];
    return rows.map((row) => mapRowToTrade(row));
  }

  async getTraderTokens(trader: string, limit = 50): Promise<string[]> {
    const rows = this.db
      .prepare(
        `SELECT LOWER(tokenAddress) AS token, MAX(timestamp) AS last FROM trades
         WHERE trader = ? COLLATE NOCASE
         GROUP BY LOWER(tokenAddress) ORDER BY last DESC LIMIT ?`,
      )
      .all(trader, limit) as Array<{ token: string }>;
    return rows.map((r) => r.token);
  }

  async getTradesByTrader(
    trader: string,
    limit = 50,
    tokenAddress?: string,
  ): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE trader = ? COLLATE NOCASE
        AND (? IS NULL OR tokenAddress = ? COLLATE NOCASE)
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ?
    `);
    const token = tokenAddress ?? null;
    const rows = stmt.all(trader, token, token, limit) as TradeRow[];
    return rows.map((row) => mapRowToTrade(row));
  }

  async getTradesInBlockRange(
    fromBlock: bigint,
    toBlock: bigint,
    limit: number,
    tokenAddress?: `0x${string}`,
  ): Promise<TradeEventEntity[]> {
    // Optional bounds are left out rather than written as `? = 0 OR ...`, which no index can bound.
    const params: (string | number)[] = [Number(fromBlock)];
    let where = 'CAST(blockNumber AS INTEGER) >= ?';
    if (Number(toBlock) !== 0) {
      where += ' AND CAST(blockNumber AS INTEGER) <= ?';
      params.push(Number(toBlock));
    }
    if (tokenAddress) {
      where += ' AND tokenAddress = ? COLLATE NOCASE';
      params.push(tokenAddress);
    }
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE ${where}
      ORDER BY CAST(blockNumber AS INTEGER) ASC, rowid ASC
      LIMIT ?
    `);
    const rows = stmt.all(...params, limit) as TradeRow[];
    return rows.map((row) => mapRowToTrade(row));
  }

  async getTradesSince(sinceMs: number): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE timestamp >= ?
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(sinceMs) as TradeRow[];
    return rows.map((row) => mapRowToTrade(row));
  }

  async findTradeByHash(txHash: string): Promise<TradeEventEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE transactionHash = ? COLLATE NOCASE
      LIMIT 1
    `);
    const row = stmt.get(txHash) as TradeRow | null;
    return row ? mapRowToTrade(row) : null;
  }

  /**
   * Returns estimated token positions for a trader derived from indexed trade history.
   *
   * @remarks
   * **Off-chain estimate only.** Balance is computed as
   * `sum(buy tokenAmount) - sum(sell tokenAmount)` across the last 500 indexed trades.
   * This will under-report positions for wallets that:
   * - received tokens via transfer (not a swap indexed by the poller)
   * - traded before the indexer start block
   * Use on-chain `balanceOf()` for authoritative balance when precision is required.
   */
  async getUserPositions(address: string): Promise<
    Array<{
      tokenAddress: string;
      name: string;
      symbol: string;
      logo?: string;
      balance: number;
      balanceFormatted: string;
      priceUsd: number;
      valueUsd: number;
    }>
  > {
    const trades = await this.getTradesByTrader(address, 500);
    const byToken = new Map<string, { buy: number; sell: number }>();
    for (const tr of trades) {
      const addr = tr.tokenAddress.toLowerCase();
      const cur = byToken.get(addr) || { buy: 0, sell: 0 };
      const amt = parseFloat(tr.tokenAmount || '0');
      if (tr.isBuy) cur.buy += amt;
      else cur.sell += amt;
      byToken.set(addr, cur);
    }

    const positions: Array<{
      tokenAddress: string;
      name: string;
      symbol: string;
      logo?: string;
      balance: number;
      balanceFormatted: string;
      priceUsd: number;
      valueUsd: number;
    }> = [];

    for (const [addr, stats] of byToken.entries()) {
      const net = stats.buy - stats.sell;
      if (net > 0) {
        const token = await this.tokens.findByAddress(addr as `0x${string}`);
        const md = await this.tokens.getMarketData(addr as `0x${string}`);
        const price = md?.priceUsd || 0;
        positions.push({
          tokenAddress: addr,
          name: token?.name || 'Token',
          symbol: token?.symbol || 'TOK',
          logo: token?.logo || '',
          balance: net,
          balanceFormatted: net.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          priceUsd: price,
          valueUsd: net * price,
        });
      }
    }

    positions.sort((a, b) => b.valueUsd - a.valueUsd);
    return positions;
  }

  async getVolumeByToken(
    sinceMs: number,
  ): Promise<Array<{ tokenAddress: string; totalWeth: number }>> {
    const stmt = this.db.prepare(`
      SELECT tokenAddress, SUM(CAST(wethAmount AS REAL)) AS totalWeth
      FROM trades
      WHERE timestamp >= ?
      GROUP BY tokenAddress
    `);
    return stmt.all(sinceMs) as Array<{ tokenAddress: string; totalWeth: number }>;
  }
}
