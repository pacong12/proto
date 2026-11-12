import type { TokenStorePort } from './token-store.port';
import type { TradeStorePort } from './trade-store.port';
import type { SocialStorePort } from './social-store.port';
import type { LimitOrderStorePort } from './limit-order-store.port';
import type { ReferralStorePort } from './referral-store.port';

export type { TradeFlow } from './trade-store.port';
export type {
  TokenStorePort,
  TradeStorePort,
  SocialStorePort,
  LimitOrderStorePort,
  ReferralStorePort,
};

/**
 * Everything the API stores. Consumers that need one aggregate should depend on its own port.
 */
export interface TokenRepositoryPort
  extends TokenStorePort, TradeStorePort, SocialStorePort, LimitOrderStorePort, ReferralStorePort {}
