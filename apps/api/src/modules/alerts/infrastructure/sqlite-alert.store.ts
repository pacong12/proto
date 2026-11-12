import type { Database } from 'bun:sqlite';
import type { SqliteDatabase } from '../../../core/sqlite/sqlite-database';
import type { AlertStorePort } from '../../../core/ports/alert-store.port';
import type { PriceAlert } from '@goton/shared-types';

interface AlertRow {
  id: string;
  wallet: string;
  token_address: string;
  chain_id: number;
  kind: string;
  direction: string;
  threshold: number;
  status: string;
  created_at: number;
  triggered_at: number | null;
}

const toAlert = (r: AlertRow): PriceAlert => ({
  id: r.id,
  wallet: r.wallet as `0x${string}`,
  tokenAddress: r.token_address as `0x${string}`,
  chainId: Number(r.chain_id),
  kind: r.kind as PriceAlert['kind'],
  direction: r.direction as PriceAlert['direction'],
  threshold: Number(r.threshold),
  status: r.status as PriceAlert['status'],
  createdAt: Number(r.created_at),
  triggeredAt: r.triggered_at != null ? Number(r.triggered_at) : null,
});

/** Price and market-cap alerts, stored off-chain per wallet. */
export class SqliteAlertStore implements AlertStorePort {
  private readonly db: Database;
  constructor(database: SqliteDatabase) {
    this.db = database.db;
  }

  async savePriceAlert(a: PriceAlert): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO price_alerts
           (id, wallet, token_address, chain_id, kind, direction, threshold, status, created_at, triggered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        a.id,
        a.wallet.toLowerCase(),
        a.tokenAddress.toLowerCase(),
        a.chainId,
        a.kind,
        a.direction,
        a.threshold,
        a.status,
        a.createdAt,
        a.triggeredAt ?? null,
      );
  }

  async listPriceAlerts(filter: {
    wallet?: string;
    status?: PriceAlert['status'];
    limit?: number;
  }): Promise<PriceAlert[]> {
    const where: string[] = [];
    const args: Array<string | number> = [];
    if (filter.wallet) {
      where.push('wallet = ? COLLATE NOCASE');
      args.push(filter.wallet.toLowerCase());
    }
    if (filter.status) {
      where.push('status = ?');
      args.push(filter.status);
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM price_alerts ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...args, Math.min(filter.limit ?? 200, 500)) as AlertRow[];
    return rows.map(toAlert);
  }

  async getPriceAlert(id: string): Promise<PriceAlert | null> {
    const row = this.db
      .prepare(`SELECT * FROM price_alerts WHERE id = ?`)
      .get(id) as AlertRow | null;
    return row ? toAlert(row) : null;
  }

  async deletePriceAlert(id: string, wallet: string): Promise<boolean> {
    const res = this.db
      .prepare(`DELETE FROM price_alerts WHERE id = ? AND wallet = ? COLLATE NOCASE`)
      .run(id, wallet.toLowerCase());
    return Number((res as { changes?: number }).changes ?? 0) > 0;
  }

  async markAlertTriggered(id: string, at: number): Promise<void> {
    this.db
      .prepare(`UPDATE price_alerts SET status = 'triggered', triggered_at = ? WHERE id = ?`)
      .run(at, id);
  }
}
