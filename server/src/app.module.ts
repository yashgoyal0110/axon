import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
// NOTE: temporary scaffolding while wiring this up
// console.log("[debug] render", props);
// TODO: drop the debug logging above
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { existsSync } from 'fs';

import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { MessagingModule } from './messaging/messaging.module';
import { EngineModule } from './engine/engine.module';
import { FlowsModule } from './flows/flows.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationsModule } from './conversations/conversations.module';
import { ContactsModule } from './contacts/contacts.module';
import { OrgsModule } from './orgs/orgs.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';

import { AuthGuard } from './common/guards/auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// In the container the compiled server lives at /app/server/dist and the SPA
// build at /app/web/dist. In local dev the relative hop is the same.
const WEB_DIST = join(__dirname, '..', '..', 'web', 'dist');

// TODO: the remaining handlers land in the next pass
