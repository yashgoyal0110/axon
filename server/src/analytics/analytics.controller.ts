import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgId } from '../common/decorators';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Headline metrics, deltas and the daily time series' })
  overview(@OrgId() orgId: string, @Query('days') days?: string) {
    return this.analytics.overview(orgId, Number(days) || 30);
  }

    @Get('flows')
    @ApiOperation({ summary: 'Per-flow performance leaderboard' })
    flows(@OrgId() orgId: string, @Query('days') days?: string) {
        return this.analytics.flowPerformance(orgId, Number(days) || 30);
    }

    @Get('channels')
    @ApiOperation({ summary: 'Volume and failure counts by channel' })
    channels(@OrgId() orgId: string, @Query('days') days?: string) {
        return this.analytics.channelBreakdown(orgId, Number(days) || 30);
    }

    @Get('funnel/:flowId')
    @ApiOperation({ summary: 'Per-node reach and drop-off for one flow' })
    funnel(@OrgId() orgId: string, @Param('flowId') flowId: string, @Query('days') days?: string) {
        return this.analytics.funnel(orgId, flowId, Number(days) || 30);
    }
}
