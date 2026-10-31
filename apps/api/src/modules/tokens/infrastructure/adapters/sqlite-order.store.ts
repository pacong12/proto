import type { LimitOrderStorePort } from '../../domain/ports/limit-order-store.port';
import { LimitOrderEntity } from '@goton/shared-types';

import { SqliteSocialStore } from './sqlite-social.store';

/** Limit, take-profit and stop-loss orders. */
export class SqliteOrderStore extends SqliteSocialStore implements LimitOrderStorePort {
  async saveLimitOrder(o: LimitOrderEntity): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO limit_orders (key, chain_id, contract, order_id, owner, token, is_buy, amount,
           min_out, sl_price_x36, sl_min_out, deadline, status, filled_leg, amount_out, created_tx,
           closed_tx, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO NOTHING`,
      )
      .run(
        o.key,
        o.chainId,
        o.contract?.toLowerCase() ?? null,
        o.orderId,
        o.owner.toLowerCase(),
        o.token.toLowerCase(),
        o.isBuy ? 1 : 0,
        o.amount,
        o.minOut,
        o.slPriceX36,
        o.slMinOut,
        o.deadline,
        o.status,
        o.filledLeg ?? null,
        o.amountOut ?? null,
        o.createdTx,
        o.closedTx ?? null,
        o.createdAt,
        o.updatedAt,
      );
  }

  async adoptLimitOrders(
    chainId: number,
    contract: string,
    keyOf: (orderId: string) => string,
  ): Promise<number> {
    const c = contract.toLowerCase();
    const rows = this.db
      .prepare(`SELECT key, order_id FROM limit_orders WHERE chain_id = ? AND contract IS NULL`)
      .all(chainId) as Array<{ key: string; order_id: string }>;
    const update = this.db.prepare(`UPDATE limit_orders SET contract = ?, key = ? WHERE key = ?`);
    for (const r of rows) update.run(c, keyOf(r.order_id), r.key);
    return rows.length;
  }

  async updateLimitOrder(
    key: string,
    patch: Partial<Pick<LimitOrderEntity, 'status' | 'filledLeg' | 'amountOut' | 'closedTx'>>,
  ): Promise<void> {
    this.db
      .prepare(
        `UPDATE limit_orders SET status = COALESCE(?, status), filled_leg = COALESCE(?, filled_leg),
           amount_out = COALESCE(?, amount_out), closed_tx = COALESCE(?, closed_tx), updated_at = ?
         WHERE key = ?`,
      )
      .run(
        patch.status ?? null,
        patch.filledLeg ?? null,
        patch.amountOut ?? null,
        patch.closedTx ?? null,
        Date.now(),
        key,
      );
  }

  async listLimitOrders(filter: {
    owner?: string;
    token?: string;
    status?: LimitOrderEntity['status'];
    chainId?: number;
    limit?: number;
  }): Promise<LimitOrderEntity[]> {
    const where: string[] = [];
    const args: Array<string | number> = [];
    const add = (clause: string, value: string | number) => {
      where.push(clause);
      args.push(value);
    };
    if (filter.owner) add('owner = ?', filter.owner.toLowerCase());
    if (filter.token) add('token = ?', filter.token.toLowerCase());
    if (filter.status) add('status = ?', filter.status);
    if (filter.chainId) add('chain_id = ?', filter.chainId);
    const rows = this.db
      .prepare(
        `SELECT * FROM limit_orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...args, Math.min(filter.limit ?? 100, 500)) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      key: String(r.key),
      chainId: Number(r.chain_id),
      contract: (r.contract as `0x${string}` | null) ?? undefined,
      orderId: String(r.order_id),
      owner: String(r.owner) as `0x${string}`,
      token: String(r.token) as `0x${string}`,
      isBuy: Number(r.is_buy) === 1,
      amount: String(r.amount),
      minOut: String(r.min_out),
      slPriceX36: String(r.sl_price_x36),
      slMinOut: String(r.sl_min_out),
      deadline: Number(r.deadline),
      status: r.status as LimitOrderEntity['status'],
      filledLeg: (r.filled_leg as LimitOrderEntity['filledLeg']) ?? undefined,
      amountOut: (r.amount_out as string) ?? undefined,
      createdTx: String(r.created_tx),
      closedTx: (r.closed_tx as string) ?? undefined,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));
  }
}
