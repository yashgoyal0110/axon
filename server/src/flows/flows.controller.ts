import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, OrgId, Public, Roles } from '../common/decorators';
import { CreateFlowDto, GenerateFlowDto, UpdateFlowDto } from './dto/flow.dto';
import { FlowsService } from './flows.service';

@ApiTags('flows')
@Controller('flows')
export class FlowsController {
  constructor(private readonly flows: FlowsService) {}

  @Public()
  @Get('templates')
  @ApiOperation({ summary: 'Built-in flow templates (public - powers the marketing gallery)' })
  templates() {
    return this.flows.templates();
  }

  @Public()
  @Get('templates/:key')
  @ApiOperation({ summary: 'Full graph for one template' })
  template(@Param('key') key: string) {
    return this.flows.template(key);
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List the workspace flows' })
  list(@OrgId() orgId: string, @Query('includeArchived') includeArchived?: string) {
    return this.flows.list(orgId, includeArchived === 'true');
  }

  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Fetch one flow with validation issues' })
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.flows.get(orgId, id);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENT)
  @Post()
  @ApiOperation({ summary: 'Create a flow, optionally seeded from a template' })
  create(@OrgId() orgId: string, @CurrentUser('userId') userId: string, @Body() dto: CreateFlowDto) {
    return this.flows.create(orgId, userId, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENT)
  @Patch(':id')
  @ApiOperation({ summary: 'Update flow settings or graph' })
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateFlowDto,
  ) {
    return this.flows.update(orgId, id, userId, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENT)
  @Post(':id/publish')
  @ApiOperation({ summary: 'Validate and publish a new immutable version' })
  publish(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { notes?: string },
  ) {
    return this.flows.publish(orgId, id, userId, body?.notes);
  }

  @ApiBearerAuth()
  @Get(':id/versions')
  @ApiOperation({ summary: 'Published version history' })
  versions(@OrgId() orgId: string, @Param('id') id: string) {
    return this.flows.versions(orgId, id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post(':id/versions/:version/restore')
  @ApiOperation({ summary: 'Restore a previous version into the draft' })
  restore(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser('userId') userId: string,
  ) {
    return this.flows.restore(orgId, id, version, userId);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENT)
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a flow' })
  duplicate(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.flows.duplicate(orgId, id, userId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Archive a flow' })
  remove(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.flows.remove(orgId, id, userId);
  }

  @ApiBearerAuth()
  @Post('validate')
  @ApiOperation({ summary: 'Validate a graph without saving it' })
  validate(@Body() body: { graph: unknown }) {
    return this.flows.validate(body?.graph);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENT)
  @Post('generate')
  @ApiOperation({ summary: 'Generate a flow graph from a business description with AI' })
  generate(@OrgId() orgId: string, @Body() dto: GenerateFlowDto) {
    return this.flows.generate(orgId, dto);
  }

  @ApiBearerAuth()
  @Post(':id/preview')
  @ApiOperation({ summary: 'Dry-run a flow without touching real conversations' })
  preview(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() body: { history?: Array<{ role: 'user' | 'bot'; text: string }>; message: string },
  ) {
    return this.flows.preview(orgId, id, body?.history ?? [], body?.message ?? '');
  }
}
