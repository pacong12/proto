/** First-touch referral attribution: which wallet referred which (off-chain). */
export interface ReferralStorePort {
  /**
   * Attributes `referee` to `referrer`, first-touch: a referee already attributed keeps its first
   * referrer. @returns whether a new attribution was recorded.
   */
  recordReferral?(referee: string, referrer: string, at: number): Promise<boolean>;
  /** The referrer a referee was first attributed to, or null. */
  getReferrerOf?(referee: string): Promise<string | null>;
  /** How many wallets a referrer has referred, and the most recent ones. */
  getReferralStats?(
    referrer: string,
    limit?: number,
  ): Promise<{ count: number; referees: Array<{ referee: string; createdAt: number }> }>;
}
