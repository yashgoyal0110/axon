import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlowStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFlowDto {
  @ApiProperty({ example: 'Lead qualification' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @ApiPropertyOptional({ description: 'React Flow graph - { nodes, edges }' })
  @IsOptional()
  @IsObject()
  graph?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Seed the flow from a built-in template key' })
  @IsOptional()
  @IsString()
  templateKey?: string;
}

export class UpdateFlowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  graph?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerKeywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  @ApiPropertyOptional({ description: 'System prompt that shapes the AI voice' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aiPersona?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fallbackMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: FlowStatus })
  @IsOptional()
  @IsEnum(FlowStatus)
  status?: FlowStatus;
}

export class GenerateFlowDto {
  @ApiProperty({ example: 'Brew & Bean' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  businessName!: string;

  @ApiProperty({ example: 'A speciality coffee roastery taking orders and bookings over WhatsApp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  businessDescription!: string;

  @ApiPropertyOptional({ example: 'Book a table', description: 'What the conversation should achieve' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  goal?: string;
}

export class SimulateDto {
  @ApiProperty({ example: 'hello' })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ description: 'Omit to start a fresh simulated session' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
