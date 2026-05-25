import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, OrgId, Public, UserOnly } from '../common/decorators';
import type { AuthedRequest } from '../common/types';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    private ctx(req: AuthedRequest) {
        return { ip: req.ip, userAgent: req.header('user-agent') };
    }

    @Public()
    // Credential endpoints get a much tighter budget than the global default.
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @Post('register')
    @ApiOperation({ summary: 'Create an account and its first workspace' })
    register(@Body() dto: RegisterDto, @Req() req: AuthedRequest) {
        return this.auth.register(dto, this.ctx(req));
    }

    @Public()
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @Post('login')
    @ApiOperation({ summary: 'Exchange credentials for an access + refresh token pair' })
    login(@Body() dto: LoginDto, @Req() req: AuthedRequest) {
        return this.auth.login(dto, this.ctx(req));
    }

    @Public()
    @Throttle({ default: { limit: 30, ttl: 60_000 } })
    @Post('refresh')
    @ApiOperation({ summary: 'Rotate a refresh token for a new session' })
    refresh(@Body() dto: RefreshDto, @Req() req: AuthedRequest) {
        return this.auth.refresh(dto.refreshToken, this.ctx(req));
    }

    @Public()
    @Post('logout')
    @ApiOperation({ summary: 'Revoke a refresh token' })
    logout(@Body() dto: Partial<RefreshDto>) {
        return this.auth.logout(dto.refreshToken);
    }

  @ApiBearerAuth()
  @UserOnly()
  @Get('me')
  @ApiOperation({ summary: 'Current user, active workspace and memberships' })
  me(@CurrentUser('userId') userId: string, @OrgId() orgId: string) {
    return this.auth.me(userId, orgId);
  }

  @ApiBearerAuth()
  @UserOnly()
  @Post('switch-org/:orgId')
  @ApiOperation({ summary: 'Issue a session scoped to a different workspace' })
  switchOrg(
    @CurrentUser('userId') userId: string,
    @Param('orgId') orgId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.auth.switchOrg(userId, orgId, this.ctx(req));
  }

  @ApiBearerAuth()
  @UserOnly()
  @Patch('profile')
  @ApiOperation({ summary: 'Update the signed-in user profile' })
  updateProfile(@CurrentUser('userId') userId: string, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  @ApiBearerAuth()
  @UserOnly()
  @Post('change-password')
  @ApiOperation({ summary: 'Change password and revoke all other sessions' })
  changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto);
  }
}
