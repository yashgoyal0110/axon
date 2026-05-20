import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, OrgId, Roles } from '../common/decorators';
import { ChannelsService } from './channels.service';
import { CreateChannelDto, TestChannelDto, UpdateChannelDto } from './dto/channel.dto';

@ApiTags('channels')
@ApiBearerAuth()
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get('providers')
  @ApiOperation({ summary: 'Supported providers and the credentials each needs' })
  providers() {
    return this.channels.catalogue();
  }

  @Get()
  @ApiOperation({ summary: 'List channels' })
  list(@OrgId() orgId: string) {
    return this.channels.list(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one channel' })
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.channels.get(orgId, id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Connect a channel' })
  create(@OrgId() orgId: string, @CurrentUser('userId') userId: string, @Body() dto: CreateChannelDto) {
    return this.channels.create(orgId, userId, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a channel or rotate its credentials' })
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channels.update(orgId, id, userId, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/test')
  @ApiOperation({ summary: 'Verify credentials, optionally by sending a real message' })
  test(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: TestChannelDto) {
    return this.channels.test(orgId, id, dto?.to);
  }

  @Roles(Role.ADMIN)
  @Post(':id/rotate-webhook')
  @ApiOperation({ summary: 'Issue a new webhook URL and verify token' })
  rotate(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.channels.rotateWebhook(orgId, id, userId);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Disconnect a channel' })
  remove(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.channels.remove(orgId, id, userId);
  }
}
