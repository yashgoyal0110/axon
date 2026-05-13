import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelProvider, ChannelStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { MessagingService } from '../messaging/messaging.service';
import { encryptJson, randomToken } from '../common/crypto.util';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';

// TODO: finish the error/loading branches below
// (kept short on purpose while the shape firms up)
