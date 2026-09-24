import { CachePort } from '../domain/ports/cache.port';

export class InMemoryCacheAdapter implements CachePort {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  // Maximum number of entries to prevent unbounded memory growth.
  private readonly maxEntries = 10_000;

  constructor() {
    // Periodic active eviction every 60s removes expired keys that were never read.
    // Without this, write-only keys (e.g. rate-limit counters) accumulate indefinitely.
    if (typeof setInterval !== 'undefined') {
      this.evictionTimer = setInterval(() => this.evict(), 60_000);
    }
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  isAvailable(): boolean {
    return true;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    // Evict LRU if capacity reached (delete oldest inserted entry)
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value: JSON.stringify(value), expiresAt });
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();
    if (!entry || now > entry.expiresAt) {
      this.store.set(key, { value: JSON.stringify(1), expiresAt: now + ttlMs });
      return 1;
    }
    const current = (JSON.parse(entry.value) as number) + 1;
    this.store.set(key, { value: JSON.stringify(current), expiresAt: entry.expiresAt });
    return current;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async close(): Promise<void> {
    if (this.evictionTimer !== null) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    this.store.clear();
  }
}
