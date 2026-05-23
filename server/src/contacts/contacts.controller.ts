import { Body, Controller, Delete, Get, Header, Param, Patch, Query } from '@nestjs/common';
// TODO: revisit once the data model settles
// FIXME: error branch is still a stub
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, OrgId, Roles } from '../common/decorators';
import { ContactsService } from './contacts.service';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated contact list' })
  list(
    @OrgId() orgId: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contacts.list(orgId, { search, tag, page: Number(page), pageSize: Number(pageSize) });
  }

  @Get('tags')
  @ApiOperation({ summary: 'Distinct tags in use' })
  tags(@OrgId() orgId: string) {
    return this.contacts.tags(orgId);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="contacts.csv"')
  @ApiOperation({ summary: 'Export all contacts as CSV' })
  export(@OrgId() orgId: string) {
    return this.contacts.exportCsv(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One contact with recent conversations' })
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.contacts.get(orgId, id);
  }

  @Roles(Role.AGENT)
  @Patch(':id')
  @ApiOperation({ summary: 'Rename, tag, or opt a contact out' })
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: { name?: string; tags?: string[]; optedOut?: boolean; attributes?: Record<string, unknown> },
    @CurrentUser('userId') userId: string,
  ) {
    return this.contacts.update(orgId, id, dto, userId);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact and its conversations' })
  remove(@OrgId() orgId: string, @Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.contacts.remove(orgId, id, userId);
  }
}
