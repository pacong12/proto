import Redis, { RedisOptions } from 'ioredis';
import { CachePort } from '../domain/ports/cache.port';
import { LoggerPort } from '../domain/ports/logger.port';

export class RedisCacheAdapter implements CachePort {
  private client: Redis | null = null;
  private connected = false;

  constructor(
    private readonly redisUrl: string | undefined,
    private readonly logger?: LoggerPort,
  ) {
    if (!this.redisUrl || process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      const options: RedisOptions = {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 3000,
        lazyConnect: true,
      };

      this.client = new Redis(this.redisUrl, options);

      this.client.on('connect', () => {
        this.connected = true;
        this.logger?.info('[RedisCacheAdapter] Connected to Redis successfully');
      });

      this.client.on('error', (err) => {
        this.connected = false;
        this.logger?.warn(`[RedisCacheAdapter] Redis connection error: ${(err as Error).message}`);
      });

      this.client.connect().catch((err) => {
        this.connected = false;
        this.logger?.warn(
          `[RedisCacheAdapter] Initial connection failed: ${(err as Error).message}`,
        );
      });
    } catch (err) {
      this.client = null;
      this.connected = false;
      this.logger?.warn(
        `[RedisCacheAdapter] Failed to instantiate Redis client: ${(err as Error).message}`,
      );
    }
  }

  isAvailable(): boolean {
    return this.connected && this.client !== null && this.client.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable() || !this.client) {
      return null;
    }

    try {
      const val = await this.client.get(key);
      if (!val) return null;
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      // Use a BigInt-safe replacer so token fields like positionId / launchBlock
      // do not cause a silent serialization failure and a permanent cache miss.
      const serialized = JSON.stringify(value, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
      if (ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err) {
      this.logger?.warn(`[RedisCacheAdapter] set("${key}") failed: ${(err as Error).message}`);
    }
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Redis unavailable');
    }
    // INCR is atomic. If the key does not exist Redis creates it with value 0
    // then increments to 1. We set PX expiry only on initial creation using a
    // Lua script so the window is not reset on every increment.
    const result = (await this.client.eval(
      `local v = redis.call('INCR', KEYS[1])
       if v == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
       return v`,
      1,
      key,
      String(ttlMs),
    )) as number;
    return result;
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch {
      // Non-blocking
    }
  }

  async delPrefix(prefix: string): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }

    try {
      // Use SCAN instead of KEYS to avoid blocking the Redis event loop on large keyspaces.
      // KEYS is O(N) and holds the Redis lock for its entire duration; SCAN iterates in batches.
      let cursor = '0';
      const toDelete: string[] = [];
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        toDelete.push(...keys);
      } while (cursor !== '0');
      if (toDelete.length > 0) {
        await this.client.del(...toDelete);
      }
    } catch {
      // Non-blocking
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.connected = false;
      this.client = null;
    }
  }
}
