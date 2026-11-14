import type { Database } from 'bun:sqlite';
import type { SqliteDatabase } from '../../../core/sqlite/sqlite-database';
import type { PushStorePort, PushSubscriptionRecord } from '../../../core/ports/push-store.port';

interface PushRow {
  endpoint: string;
  wallet: string;
  p256dh: string;
  auth: string;
  created_at: number;
}

const toRecord = (r: PushRow): PushSubscriptionRecord => ({
  endpoint: r.endpoint,
  wallet: r.wallet,
  p256dh: r.p256dh,
  auth: r.auth,
  createdAt: Number(r.created_at),
});

/** Browser Web Push subscriptions, stored per wallet and keyed by endpoint. */
export class SqlitePushStore implements PushStorePort {
  private readonly db: Database;
  constructor(database: SqliteDatabase) {
    this.db = database.db;
  }

  async savePushSubscription(sub: PushSubscriptionRecord): Promise<void> {
    // Re-registering the same endpoint keeps one row and re-points it at the current wallet/keys.
    this.db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, wallet, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           wallet = excluded.wallet, p256dh = excluded.p256dh, auth = excluded.auth`,
      )
      .run(sub.endpoint, sub.wallet.toLowerCase(), sub.p256dh, sub.auth, sub.createdAt);
  }

  async listPushSubscriptionsByWallet(wallet: string): Promise<PushSubscriptionRecord[]> {
    const rows = this.db
      .prepare(`SELECT * FROM push_subscriptions WHERE wallet = ? COLLATE NOCASE`)
      .all(wallet.toLowerCase()) as PushRow[];
    return rows.map(toRecord);
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const res = this.db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
    return res.changes > 0;
  }
}
