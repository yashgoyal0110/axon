import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { VisitContext } from './visit-context';

interface BufferedVisit extends VisitContext {
  path: string;
  referrer?: string;
}

export interface VisitStats {
  totalVisits: number;
  uniqueVisitors: number;
  last24h: number;
  topCountries: Array<{ country: string; visits: number }>;
}

/** Flush cadence. Small enough to feel live, large enough to batch usefully. */
const FLUSH_INTERVAL_MS = 10_000;
/** Flush early once the buffer reaches this, so a traffic spike cannot pile up. */
const FLUSH_AT = 100;
/** Hard ceiling. Past this we drop rather than let a stalled DB grow the heap. */
const BUFFER_MAX = 5_000;
/** One visitor hitting one path counts once per window, so refreshes do not inflate. */
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const STATS_CACHE_KEY = 'visits:stats';
const STATS_CACHE_TTL = 60;

@Injectable()
export class VisitsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VisitsService.name);

  private buffer: BufferedVisit[] = [];
  private recent = new Map<string, number>();
  private timer?: NodeJS.Timeout;
  private flushing = false;
  private dropped = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    // Never hold the process open just to write a page view.
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    // Best effort so a graceful restart does not lose the last few seconds.
    await this.flush();
  }

  /**
   * Records a visit. Deliberately synchronous and allocation-only: the HTTP
   * handler returns without touching Postgres, Redis or the network, so the
   * page load is never waiting on analytics.
   */
  record(visit: BufferedVisit): void {
    if (visit.isBot) return;

    const key = `${visit.visitorId}:${visit.path}`;
    const now = Date.now();
    const seen = this.recent.get(key);
    if (seen && now - seen < DEDUPE_WINDOW_MS) return;
    this.recent.set(key, now);

    if (this.buffer.length >= BUFFER_MAX) {
      this.dropped += 1;
      return;
    }

    this.buffer.push(visit);
    if (this.buffer.length >= FLUSH_AT) void this.flush();
  }

  /**
   * Writes the buffer in three queries regardless of how many visits it holds,
   * then moves the aggregate forward. Never throws: losing a page view must
   * not take down the request that scheduled the flush.
   */
  private async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    const batch = this.buffer;
    this.buffer = [];

    try {
      await this.prisma.pageVisit.createMany({
        data: batch.map((v) => ({
          path: v.path,
          referrer: v.referrer,
          visitorId: v.visitorId,
          ip: v.ip,
          country: v.country,
          region: v.region,
          city: v.city,
          browser: v.browser,
          os: v.os,
          device: v.device,
          language: v.language,
          isBot: v.isBot,
        })),
      });

      // skipDuplicates means the returned count is exactly the number of
      // visitors we had never seen before, without a second read.
      const ids = [...new Set(batch.map((v) => v.visitorId))];
      const { count: newVisitors } = await this.prisma.visitorProfile.createMany({
        data: ids.map((id) => ({ id })),
        skipDuplicates: true,
      });

      await this.prisma.visitCounter.upsert({
        where: { id: 'global' },
        create: { id: 'global', totalVisits: batch.length, uniqueVisitors: newVisitors },
        update: {
          totalVisits: { increment: batch.length },
          uniqueVisitors: { increment: newVisitors },
        },
      });

      if (this.dropped > 0) {
        this.logger.warn(`Dropped ${this.dropped} visits while the buffer was saturated`);
        this.dropped = 0;
      }
      this.pruneRecent();
    } catch (error) {
      this.logger.warn(`Visit flush failed, discarding ${batch.length} rows: ${(error as Error).message}`);
    } finally {
      this.flushing = false;
    }
  }

  /** Keeps the dedupe map from growing without bound on a long-lived process. */
  private pruneRecent(): void {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    for (const [key, seen] of this.recent) {
      if (seen < cutoff) this.recent.delete(key);
    }
  }

  /**
   * Cached for a minute. The badge reads a single counter row rather than
   * counting a table that only ever grows.
   */
  async stats(): Promise<VisitStats> {
    const cached = await this.redis.getJson<VisitStats>(STATS_CACHE_KEY);
    if (cached) return cached;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [counter, last24h, countries] = await Promise.all([
      this.prisma.visitCounter.findUnique({ where: { id: 'global' } }),
      this.prisma.pageVisit.count({ where: { createdAt: { gte: since } } }),
      this.prisma.pageVisit.groupBy({
        by: ['country'],
        where: { country: { not: null } },
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: 5,
      }),
    ]);

    const stats: VisitStats = {
      totalVisits: counter?.totalVisits ?? 0,
      uniqueVisitors: counter?.uniqueVisitors ?? 0,
      last24h,
      topCountries: countries.map((c) => ({ country: c.country as string, visits: c._count.country })),
    };

    await this.redis.setJson(STATS_CACHE_KEY, stats, STATS_CACHE_TTL);
    return stats;
  }
}
