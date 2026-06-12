import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelProvider, ChannelStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'Production WhatsApp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiProperty({ enum: ChannelProvider })
  @IsEnum(ChannelProvider)
  provider!: ChannelProvider;

  @ApiPropertyOptional({ example: '+14155238886' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Flow that answers on this channel' })
  @IsOptional()
  @IsString()
  flowId?: string;

  @ApiPropertyOptional({ description: 'Provider credentials - encrypted at rest, never read back' })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

export class UpdateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flowId?: string | null;

  @ApiPropertyOptional({ enum: ChannelStatus })
  @IsOptional()
  @IsEnum(ChannelStatus)
  status?: ChannelStatus;

  @ApiPropertyOptional({ description: 'Partial credential update - merged with what is stored' })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

export class TestChannelDto {
  @ApiPropertyOptional({ example: '+919876543210', description: 'Send a real test message to this number' })
  @IsOptional()
  @IsString()
  to?: string;
}
