import type { PriceAlert } from '@goton/shared-types';

/** Price and market-cap alerts a wallet sets on a token. */
export interface AlertStorePort {
  savePriceAlert?(alert: PriceAlert): Promise<void>;
  /** Alerts matching the filter: a wallet's, a status, or both. Newest first. */
  listPriceAlerts?(filter: {
    wallet?: string;
    status?: PriceAlert['status'];
    limit?: number;
  }): Promise<PriceAlert[]>;
  getPriceAlert?(id: string): Promise<PriceAlert | null>;
  /** Removes the alert only when `wallet` owns it. @returns whether a row was removed. */
  deletePriceAlert?(id: string, wallet: string): Promise<boolean>;
  markAlertTriggered?(id: string, at: number): Promise<void>;
}
