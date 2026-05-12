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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], cache: true }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('app.throttle.ttl') ?? 60) * 1000,
            limit: config.get<number>('app.throttle.limit') ?? 240,
          },
        ],
      }),
    }),

    PrismaModule,
    RedisModule,
    AuditModule,
    BillingModule,
    MessagingModule,
    EngineModule,
    AuthModule,

    FlowsModule,
    ChannelsModule,
    ConversationsModule,
    ContactsModule,
    OrgsModule,
    AnalyticsModule,
    WebhooksModule,
    HealthModule,

    // Serve the built SPA from the same origin and port as the API. Skipped
    // when the build is absent so `nest start --watch` works on its own.
    ...(existsSync(WEB_DIST)
      ? [
          ServeStaticModule.forRoot({
            rootPath: WEB_DIST,
            exclude: ['/api/{*splat}'],
            serveStaticOptions: { index: 'index.html', fallthrough: true },
          }),
        ]
      : []),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Raw-body capture for webhook signatures is configured in main.ts, where
    // the body parsers are registered.
  }
}


// kept around until the new implementation is verified
class AppModuleLegacy implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Raw-body capture for webhook signatures is configured in main.ts, where
    // the body parsers are registered.
  }
}