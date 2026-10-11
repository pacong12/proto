import type { TradeEventEntity } from '@proto/shared-types';

export type { TradeEventEntity };

export interface TopTraderItem {
  address: string;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  totalTrades: number;
  profitUsd: number;
  isDev: boolean;
  walletTag: string;
  firstBuyTimestamp: number;
  firstBuyPriceUsd: number;
  avgCostUsd: number;
  holdingAmountTokens: string;
  positionStatus: 'holding' | 'partial' | 'clean_all';
}
