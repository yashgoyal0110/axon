import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import type { AuthedRequest } from '../common/types';
import { buildVisitContext } from './visit-context';
import { VisitsService } from './visits.service';

class TrackVisitDto {
  @ApiPropertyOptional({ example: '/pricing' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;
}

@ApiTags('visits')
@Controller('visits')
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  // Generous enough for real browsing, tight enough that one client cannot
  // fabricate traffic. The in-memory dedupe does the rest.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post()
  @HttpCode(204)
  @ApiOperation({ summary: 'Record a page visit (buffered, returns immediately)' })
  track(@Body() dto: TrackVisitDto, @Req() req: AuthedRequest): void {
    const salt = this.config.get<string>('app.jwt.secret') ?? 'axon';
    const context = buildVisitContext(req.headers, req.ip, salt);

    this.visits.record({
      ...context,
      path: (dto.path ?? '/').slice(0, 255),
      referrer: dto.referrer?.slice(0, 500) || undefined,
    });
    // No await anywhere above; the response goes out on the same tick.
  }

  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Public visit totals for the site counter' })
  stats() {
    return this.visits.stats();
  }
}
