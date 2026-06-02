import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, OrgId, Public, Roles, UserOnly } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { OrgsService } from './orgs.service';

class UpdateOrgDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

class InviteDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: Role, default: Role.AGENT })
  @IsEnum(Role)
  role!: Role;
}

class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({ description: 'Required when the invitee has no account yet' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

class RoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}

class ApiKeyDto {
  @ApiProperty({ example: 'Zapier integration' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;
}

@ApiTags('workspace')
@Controller('org')
export class OrgsController {
  constructor(
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Current workspace' })
  get(@OrgId() orgId: string) {
    return this.orgs.get(orgId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch()
  @ApiOperation({ summary: 'Update workspace settings' })
  update(@OrgId() orgId: string, @Body() dto: UpdateOrgDto, @CurrentUser('userId') userId: string) {
    return this.orgs.update(orgId, dto, userId);
  }

  @ApiBearerAuth()
  @Get('members')
  @ApiOperation({ summary: 'Members and pending invitations' })
  members(@OrgId() orgId: string) {
    return this.orgs.members(orgId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('members/invite')
  @ApiOperation({ summary: 'Invite a teammate' })
  invite(@OrgId() orgId: string, @Body() dto: InviteDto, @CurrentUser('userId') userId: string) {
    return this.orgs.invite(orgId, dto.email, dto.role, userId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('members/invite/:id')
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revokeInvite(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.orgs.revokeInvite(orgId, id, userId);
  }

  @Public()
  @Post('members/accept')
  @ApiOperation({ summary: 'Accept an invitation, creating an account if needed' })
  accept(@Body() dto: AcceptInviteDto) {
    return this.orgs.acceptInvite(
      dto.token,
      dto.name && dto.password ? { name: dto.name, password: dto.password } : undefined,
    );
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('members/:userId/role')
  @ApiOperation({ summary: 'Change a member role' })
  setRole(
    @OrgId() orgId: string,
    @Param('userId') memberUserId: string,
    @Body() dto: RoleDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.orgs.updateMemberRole(orgId, memberUserId, dto.role, actorId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('members/:userId')
  @ApiOperation({ summary: 'Remove a member' })
  removeMember(
    @OrgId() orgId: string,
    @Param('userId') memberUserId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.orgs.removeMember(orgId, memberUserId, actorId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('api-keys')
  @ApiOperation({ summary: 'List API keys' })
  apiKeys(@OrgId() orgId: string) {
    return this.orgs.listApiKeys(orgId);
  }

  @ApiBearerAuth()
  @UserOnly()
  @Roles(Role.ADMIN)
  @Post('api-keys')
  @ApiOperation({ summary: 'Create an API key - the secret is shown once' })
  createApiKey(@OrgId() orgId: string, @Body() dto: ApiKeyDto, @CurrentUser('userId') userId: string) {
    return this.orgs.createApiKey(orgId, dto.name, userId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeApiKey(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.orgs.revokeApiKey(orgId, id, userId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('audit')
  @ApiOperation({ summary: 'Audit trail' })
  auditLog(@OrgId() orgId: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.audit.list(orgId, Number(page) || 1, Number(pageSize) || 50);
  }
}
