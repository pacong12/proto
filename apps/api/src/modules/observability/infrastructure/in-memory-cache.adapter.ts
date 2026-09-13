import { CachePort } from '../domain/ports/cache.port';

export class InMemoryCacheAdapter implements CachePort {
  private store = new Map<string, { value: string; expiresAt: number }>();

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
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value: JSON.stringify(value), expiresAt });
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
    this.store.clear();
  }
}
