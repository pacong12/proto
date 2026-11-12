import type { Database } from 'bun:sqlite';
import type { SqliteDatabase } from '../../../core/sqlite/sqlite-database';
import type { ReferralStorePort } from '../../../core/ports/referral-store.port';

/** First-touch referral attribution, stored off-chain. */
export class SqliteReferralStore implements ReferralStorePort {
  private readonly db: Database;
  constructor(database: SqliteDatabase) {
    this.db = database.db;
  }

  async recordReferral(referee: string, referrer: string, at: number): Promise<boolean> {
    const res = this.db
      .prepare(`INSERT OR IGNORE INTO referrals (referee, referrer, created_at) VALUES (?, ?, ?)`)
      .run(referee.toLowerCase(), referrer.toLowerCase(), at);
    return Number((res as { changes?: number }).changes ?? 0) > 0;
  }

  async getReferrerOf(referee: string): Promise<string | null> {
    const row = this.db
      .prepare(`SELECT referrer FROM referrals WHERE referee = ? COLLATE NOCASE`)
      .get(referee.toLowerCase()) as { referrer: string } | null;
    return row?.referrer ?? null;
  }

  async getReferralStats(
    referrer: string,
    limit = 50,
  ): Promise<{ count: number; referees: Array<{ referee: string; createdAt: number }> }> {
    const count = Number(
      (
        this.db
          .prepare(`SELECT COUNT(*) AS n FROM referrals WHERE referrer = ? COLLATE NOCASE`)
          .get(referrer.toLowerCase()) as { n: number }
      ).n,
    );
    const rows = this.db
      .prepare(
        `SELECT referee, created_at FROM referrals WHERE referrer = ? COLLATE NOCASE
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(referrer.toLowerCase(), Math.min(limit, 200)) as Array<{
      referee: string;
      created_at: number;
    }>;
    return {
      count,
      referees: rows.map((r) => ({ referee: r.referee, createdAt: Number(r.created_at) })),
    };
  }
}
