import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationStatus, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, OrgId, Roles } from '../common/decorators';
import { ConversationsService } from './conversations.service';

class AgentReplyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}

class StatusDto {
  @ApiProperty({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}

class SimulateDto {
  @ApiProperty({ example: 'hello' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;

  @ApiPropertyOptional({ example: '+15550000001' })
  @IsOptional()
  @IsString()
  waId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channelId?: string;
}

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated inbox' })
  list(
    @OrgId() orgId: string,
    @Query('status') status?: ConversationStatus,
    @Query('channelId') channelId?: string,
    @Query('flowId') flowId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.conversations.list(orgId, {
      status,
      channelId,
      flowId,
      search,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'A conversation with its full transcript' })
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.conversations.get(orgId, id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Poll for messages after a timestamp' })
  messages(@OrgId() orgId: string, @Param('id') id: string, @Query('since') since?: string) {
    return this.conversations.messagesSince(orgId, id, since);
  }

  @Roles(Role.AGENT)
  @Post(':id/reply')
  @ApiOperation({ summary: 'Send a message as a human agent' })
  reply(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: AgentReplyDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.conversations.sendAgentMessage(orgId, id, dto.text, userId);
  }

  @Roles(Role.AGENT)
  @Post(':id/status')
  @ApiOperation({ summary: 'Close, reopen or hand off a conversation' })
  setStatus(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: StatusDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.conversations.setStatus(orgId, id, dto.status, userId);
  }

  @Roles(Role.AGENT)
  // The simulator can trigger AI calls, so it gets its own tighter budget.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('simulate')
  @ApiOperation({ summary: 'Run a message through the real engine on a sandbox channel' })
  simulate(@OrgId() orgId: string, @Body() dto: SimulateDto) {
    return this.conversations.simulate(orgId, dto);
  }

  @Roles(Role.AGENT)
  @Post('simulate/reset')
  @ApiOperation({ summary: 'Abandon the simulated session and start fresh' })
  reset(@OrgId() orgId: string, @Body() body: { waId?: string }) {
    return this.conversations.resetSimulator(orgId, body?.waId ?? '+15550000001');
  }
}
