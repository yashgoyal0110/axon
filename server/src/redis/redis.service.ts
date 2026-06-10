import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Optional Redis layer. Everything degrades to an in-process fallback when
 * Redis is disabled so a single-container deploy works with zero extra
 * infrastructure - the counters are then per-instance rather than global.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {
    const enabled = this.config.get<boolean>('app.redis.enabled');
    const url = this.config.get<string>('app.redis.url');

    if (enabled && url) {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 2,
        lazyConnect: false,
        retryStrategy: (times) => Math.min(times * 200, 3000),
      });
      this.client.on('connect', () => this.logger.log('Redis connected'));
      this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
    } else {
      this.logger.log('Redis disabled - using in-process cache and counters');
    }
  }

  get isRemote(): boolean {
    return !!this.client;
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch {
        return null;
      }
    }
    const hit = this.memory.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.client) {
      try {
        await this.client.set(key, value, 'EX', ttlSeconds);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        /* fall through */
      }
    }
    this.memory.delete(key);
  }

  /** Atomic increment with TTL applied on first write. Used by rate limiters. */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    if (this.client) {
      try {
        const pipeline = this.client.multi();
        pipeline.incr(key);
        pipeline.expire(key, ttlSeconds, 'NX');
        const results = await pipeline.exec();
        const value = results?.[0]?.[1];
        if (typeof value === 'number') return value;
      } catch {
        /* fall through */
      }
    }
    const existing = this.memory.get(key);
    const now = Date.now();
    if (!existing || existing.expiresAt < now) {
      this.memory.set(key, { value: '1', expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number(existing.value) + 1;
    existing.value = String(next);
    return next;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /** Best-effort prefix invalidation - used when a tenant mutates cached data. */
  async delByPrefix(prefix: string): Promise<void> {
    if (this.client) {
      try {
        const stream = this.client.scanStream({ match: `${prefix}*`, count: 200 });
        for await (const keys of stream) {
          if ((keys as string[]).length) await this.client.del(...(keys as string[]));
        }
        return;
      } catch {
        /* fall through */
      }
    }
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }
}
