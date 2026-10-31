import type { TradeStorePort } from '../../domain/ports/trade-store.port';
import { TradeEventEntity, CandlestickEntity, chartPriceUsd } from '@goton/shared-types';
import type { TradeFlow } from '../../domain/ports/token.repository.port';
import {
  aggregateCandlesticks,
  chartEndTime,
  chartStartTime,
  computeHoldersDistribution,
  holdersFromBalances,
} from '../../domain/services/token-aggregation.service';
import { POOL_HOLDERS, TradeRow } from './sqlite-rows';

import { SqliteTokenStore } from './sqlite-token.store';

/** Indexed trades and what is derived from them (candles, flow, holders, positions). */
export class SqliteTradeStore extends SqliteTokenStore implements TradeStorePort {
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
    return rows.map((row) => this.mapRowToTrade(row));
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
    return row ? this.mapRowToTrade(row) : null;
  }

  async getCandlesticks(
    tokenAddress: `0x${string}`,
    resolutionSeconds = 60,
    fillGaps = false,
    quotePriceUsd?: number,
  ): Promise<CandlestickEntity[]> {
    const token = await this.findByAddress(tokenAddress);
    const mkt = await this.getMarketData(tokenAddress);
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE tokenAddress = ? COLLATE NOCASE
      ORDER BY timestamp ASC, rowid ASC
    `);
    const rows = (stmt.all(tokenAddress) as TradeRow[]).map((row) => ({
      ...row,
      priceUsd: chartPriceUsd(
        { priceUsd: row.priceUsd, priceQuote: row.priceQuote ?? undefined },
        quotePriceUsd,
      ),
    }));
    return aggregateCandlesticks(rows, resolutionSeconds, {
      startTime: chartStartTime(token?.createdAt, rows[0]?.timestamp),
      endTime: chartEndTime(rows[rows.length - 1]?.timestamp),
      fillGaps,
      maxCandles: 1000,
      fallbackPrice: mkt?.priceUsd || 0.0000042,
    });
  }

  async getHolders(
    tokenAddress: string,
    limit = 50,
  ): Promise<Array<{ address: string; balance: string; percent: number }>> {
    const token = await this.findByAddress(tokenAddress as `0x${string}`);
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
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async getTradesByTrader(
    trader: string,
    limit = 50,
    tokenAddress?: string,
  ): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(trader) = LOWER(?)
        AND (? IS NULL OR tokenAddress = ? COLLATE NOCASE)
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ?
    `);
    const token = tokenAddress ?? null;
    const rows = stmt.all(trader, token, token, limit) as TradeRow[];
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async getTradesInBlockRange(
    fromBlock: bigint,
    toBlock: bigint,
    limit: number,
    tokenAddress?: `0x${string}`,
  ): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE CAST(blockNumber AS INTEGER) >= ?
        AND (? = 0 OR CAST(blockNumber AS INTEGER) <= ?)
        AND (? IS NULL OR tokenAddress = ? COLLATE NOCASE)
      ORDER BY CAST(blockNumber AS INTEGER) ASC, rowid ASC
      LIMIT ?
    `);
    const token = tokenAddress ?? null;
    const rows = stmt.all(
      Number(fromBlock),
      Number(toBlock),
      Number(toBlock),
      token,
      token,
      limit,
    ) as TradeRow[];
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async getTradesSince(sinceMs: number): Promise<TradeEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE timestamp >= ?
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(sinceMs) as TradeRow[];
    return rows.map((row) => this.mapRowToTrade(row));
  }

  async findTradeByHash(txHash: string): Promise<TradeEventEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE LOWER(transactionHash) = LOWER(?)
      LIMIT 1
    `);
    const row = stmt.get(txHash) as TradeRow | null;
    return row ? this.mapRowToTrade(row) : null;
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
        const token = await this.findByAddress(addr as `0x${string}`);
        const md = await this.getMarketData(addr as `0x${string}`);
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
