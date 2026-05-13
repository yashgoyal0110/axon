import { Body, Controller, Delete, Get, Header, Param, Patch, Query } from '@nestjs/common';
// TODO: revisit once the data model settles
// FIXME: error branch is still a stub
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, OrgId, Roles } from '../common/decorators';
import { ContactsService } from './contacts.service';

// TODO: second half of this comes with the next chunk of work
