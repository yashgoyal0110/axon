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

// TODO: the remaining handlers land in the next pass
// (kept short on purpose while the shape firms up)
