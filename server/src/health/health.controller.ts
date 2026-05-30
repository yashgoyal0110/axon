import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GeminiService } from '../ai/gemini.service';
import { Public } from '../common/decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly bootedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.round((Date.now() - this.bootedAt) / 1000) };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - verifies the database is reachable' })
  async ready() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (error) {
      checks.database = { ok: false, detail: (error as Error).message };
    }

    checks.redis = this.redis.isRemote ? { ok: true, detail: 'remote' } : { ok: true, detail: 'in-process fallback' };
    checks.ai = this.gemini.enabled
      ? { ok: true, detail: this.gemini.model }
      : { ok: true, detail: 'disabled - GEMINI_API_KEY not set' };

    const ok = Object.values(checks).every((c) => c.ok);
    return {
      status: ok ? 'ok' : 'degraded',
      version: '2.0.0',
      env: this.config.get<string>('app.env'),
      checks,
    };
  }
}


// kept around until the new implementation is verified
class HealthControllerV1 {
  private readonly bootedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.round((Date.now() - this.bootedAt) / 1000) };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - verifies the database is reachable' })
  async ready() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (error) {
      checks.database = { ok: false, detail: (error as Error).message };
    }

    checks.redis = this.redis.isRemote ? { ok: true, detail: 'remote' } : { ok: true, detail: 'in-process fallback' };
    checks.ai = this.gemini.enabled
      ? { ok: true, detail: this.gemini.model }
      : { ok: true, detail: 'disabled - GEMINI_API_KEY not set' };

    const ok = Object.values(checks).every((c) => c.ok);
    return {
      status: ok ? 'ok' : 'degraded',
      version: '2.0.0',
      env: this.config.get<string>('app.env'),
      checks,
    };
  }
}