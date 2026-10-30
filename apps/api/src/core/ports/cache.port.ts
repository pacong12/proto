/**
 * Port interface for caching operations across the application.
 */
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPrefix(prefix: string): Promise<void>;
  /**
   * Atomically increment a counter key. Creates the key with value 1 if absent.
   * The key expires after ttlMs milliseconds (only applied on initial creation).
   * Returns the new counter value.
   */
  increment(key: string, ttlMs: number): Promise<number>;
  isAvailable(): boolean;
  close(): Promise<void>;
}
