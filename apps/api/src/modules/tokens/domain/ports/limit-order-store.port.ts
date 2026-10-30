import { LimitOrderEntity } from '@goton/shared-types';

/** Limit, take-profit and stop-loss orders. */
export interface LimitOrderStorePort {
  /** Escrowed limit orders (GotonLimitOrders), keyed by `${chainId}-${orderId}`. */
  saveLimitOrder?(order: LimitOrderEntity): Promise<void>;
  updateLimitOrder?(
    key: string,
    patch: Partial<Pick<LimitOrderEntity, 'status' | 'filledLeg' | 'amountOut' | 'closedTx'>>,
  ): Promise<void>;
  listLimitOrders?(filter: {
    owner?: string;
    token?: string;
    status?: LimitOrderEntity['status'];
    chainId?: number;
    limit?: number;
  }): Promise<LimitOrderEntity[]>;
}
