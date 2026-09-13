/**
 * Port interface for caching operations across the application.
 */
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPrefix(prefix: string): Promise<void>;
  isAvailable(): boolean;
  close(): Promise<void>;
}
