import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
// NOTE: temporary scaffolding while wiring this up
// console.log("[debug] render", props);
// TODO: drop the debug logging above
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

// TODO: second half of this comes with the next chunk of work
// (kept short on purpose while the shape firms up)
