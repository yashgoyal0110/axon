import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Plan, Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrentUser, OrgId, Public, Roles } from '../common/decorators';
import { BillingService } from './billing.service';

class ChangePlanDto {
  @ApiProperty({ enum: Plan })
  @IsEnum(Plan)
  plan!: Plan;

  @ApiPropertyOptional({
    description: 'Upgrade coupon. Required for any plan above FREE until payments are wired up.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  coupon?: string;
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Public pricing catalogue' })
  plans() {
    return this.billing.listPlans();
  }

  @ApiBearerAuth()
  @Get('usage')
  @ApiOperation({ summary: 'Current period usage, quotas and resource counts' })
  usage(@OrgId() orgId: string) {
    return this.billing.snapshot(orgId);
  }

  @ApiBearerAuth()
  @Roles(Role.OWNER)
  // Tight limit so the upgrade coupon cannot be brute-forced.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('plan')
  @ApiOperation({ summary: 'Change the workspace plan' })
  changePlan(
    @OrgId() orgId: string,
    @Body() dto: ChangePlanDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.billing.changePlan(orgId, dto.plan, userId, dto.coupon);
  }
}
