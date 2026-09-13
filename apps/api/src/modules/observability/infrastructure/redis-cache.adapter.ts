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
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch {
      // Non-blocking fallback
    }
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
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
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
