import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChannelProvider } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import type { AuthedRequest } from '../common/types';
import { ChannelsService } from '../channels/channels.service';
import { MessagingService } from '../messaging/messaging.service';
import { EngineService } from '../engine/engine.service';
import { RedisService } from '../redis/redis.service';
import type { WebhookRequest } from '../messaging/provider.types';

const PROVIDER_BY_SLUG: Record<string, ChannelProvider> = {
  meta_cloud: ChannelProvider.META_CLOUD,
  meta: ChannelProvider.META_CLOUD,
  twilio: ChannelProvider.TWILIO,
  sandbox: ChannelProvider.SANDBOX,
};

/**
 * Public provider webhooks. Every handler answers 200 quickly - providers
 * retry aggressively on non-2xx, and a downstream failure must not turn into a
 * redelivery storm.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger('Webhooks');

  constructor(
    private readonly channels: ChannelsService,
    private readonly messaging: MessagingService,
    private readonly engine: EngineService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get(':provider/:webhookId')
  async verify(
    @Param('provider') providerSlug: string,
    @Param('webhookId') webhookId: string,
    @Query() query: Record<string, unknown>,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const provider = PROVIDER_BY_SLUG[providerSlug];
    if (!provider) throw new BadRequestException('Unknown provider');

    const channel = await this.channels.byWebhookId(webhookId);
    if (channel.provider !== provider) throw new BadRequestException('Provider mismatch for this webhook');

    const adapter = this.messaging.adapterFor(provider);
    const verification = adapter.verify(this.toWebhookRequest(req, query), channel.verifyToken);

    if (verification?.challenge) {
      // Meta expects the raw challenge echoed back as text/plain.
      res.status(200).type('text/plain').send(verification.challenge);
      return;
    }
    res.status(403).json({ error: 'Verification failed' });
  }

  @Public()
  // Providers can burst; the ceiling is high but non-infinite.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post(':provider/:webhookId')
  @HttpCode(200)
  async receive(
    @Param('provider') providerSlug: string,
    @Param('webhookId') webhookId: string,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ): Promise<{ received: true }> {
    const provider = PROVIDER_BY_SLUG[providerSlug];
    if (!provider) throw new BadRequestException('Unknown provider');
    if (provider === ChannelProvider.SANDBOX) {
      throw new ForbiddenException('Sandbox messages go through the authenticated simulator endpoint');
    }

    const channel = await this.channels.byWebhookId(webhookId);
    if (channel.provider !== provider) throw new BadRequestException('Provider mismatch for this webhook');

    const adapter = this.messaging.adapterFor(provider);
    const credentials = this.messaging.credentialsFor(channel);
    const webhookRequest = this.toWebhookRequest(req, req.query as Record<string, unknown>, body);

    if (!adapter.verifySignature(webhookRequest, credentials, this.config.get<string>('app.publicUrl') as string)) {
      this.logger.warn(`Rejected unsigned webhook for channel ${channel.id}`);
      throw new ForbiddenException('Invalid webhook signature');
    }

    const inbound = adapter.parseInbound(webhookRequest);
    for (const message of inbound) {
      // Providers redeliver on timeout; skip anything already processed.
      if (message.providerMessageId) {
        const key = `wh:seen:${message.providerMessageId}`;
        if (await this.redis.get(key)) continue;
        await this.redis.set(key, '1', 3600);
      }

      try {
        await this.engine.handleInbound(channel, message);
      } catch (error) {
        // Swallow so one bad message cannot block the rest of the batch.
        this.logger.error(
          `Engine failed on channel ${channel.id} for ${message.waId}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return { received: true };
  }

  private toWebhookRequest(req: AuthedRequest, query: Record<string, unknown>, body?: unknown): WebhookRequest {
    return {
      method: req.method,
      query,
      body: body ?? req.body,
      rawBody: req.rawBody,
      headers: req.headers as Record<string, string | string[] | undefined>,
      url: req.originalUrl,
    };
  }
}
