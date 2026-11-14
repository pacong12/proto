/** A browser Web Push subscription a wallet registered so its alerts can notify it. */
export interface PushSubscriptionRecord {
  endpoint: string;
  wallet: string;
  /** The subscription's public key (base64url), from `PushSubscription.getKey('p256dh')`. */
  p256dh: string;
  /** The subscription's auth secret (base64url), from `PushSubscription.getKey('auth')`. */
  auth: string;
  createdAt: number;
}

/** Stores browser Web Push subscriptions, keyed by endpoint, owned by a wallet. */
export interface PushStorePort {
  /** Upserts a subscription for a wallet (same endpoint re-registers, keeping one row). */
  savePushSubscription?(sub: PushSubscriptionRecord): Promise<void>;
  /** Every subscription a wallet has registered (across its devices). */
  listPushSubscriptionsByWallet?(wallet: string): Promise<PushSubscriptionRecord[]>;
  /** Removes one subscription by endpoint. @returns whether a row was removed. */
  deletePushSubscription?(endpoint: string): Promise<boolean>;
}
