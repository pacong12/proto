import { LimitOrderEntity } from '@goton/shared-types';

/** Limit, take-profit and stop-loss orders. */
export interface LimitOrderStorePort {
  /** Escrowed limit orders (GotonLimitOrders), keyed by limitOrderKey (chain, contract, id). */
  saveLimitOrder?(order: LimitOrderEntity): Promise<void>;
  updateLimitOrder?(
    key: string,
    patch: Partial<Pick<LimitOrderEntity, 'status' | 'filledLeg' | 'amountOut' | 'closedTx'>>,
  ): Promise<void>;
  /**
   * Gives rows indexed before orders recorded their contract (contract NULL) the network's first
   * deployment and its key. @returns rows changed.
   */
  adoptLimitOrders?(
    chainId: number,
    contract: string,
    keyOf: (orderId: string) => string,
  ): Promise<number>;
  /** One order by its limitOrderKey, or null. */
  getLimitOrder?(key: string): Promise<LimitOrderEntity | null>;
  listLimitOrders?(filter: {
    owner?: string;
    token?: string;
    status?: LimitOrderEntity['status'];
    chainId?: number;
    /** Only orders that can still fill at this Unix time (deadline at or after it). */
    liveAt?: number;
    limit?: number;
    offset?: number;
    /** Oldest first (a stable order to page through), instead of newest first. */
    oldestFirst?: boolean;
  }): Promise<LimitOrderEntity[]>;
}
