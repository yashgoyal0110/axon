import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelProvider, MessageSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { decryptJson } from '../common/crypto.util';
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { SandboxProvider } from './providers/sandbox.provider';
import { TwilioProvider } from './providers/twilio.provider';
import type { ChannelCredentials, OutboundMessage, ProviderAdapter } from './provider.types';

export interface DispatchInput {
  channel: Channel;
  conversationId: string;
  to: string;
  text: string;
  buttons?: string[];
  nodeId?: string | null;
  source: MessageSource;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly adapters: Map<ChannelProvider, ProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
    sandbox: SandboxProvider,
    meta: MetaCloudProvider,
    twilio: TwilioProvider,
  ) {
    this.adapters = new Map<ChannelProvider, ProviderAdapter>([
      [ChannelProvider.SANDBOX, sandbox],
      [ChannelProvider.META_CLOUD, meta],
      [ChannelProvider.TWILIO, twilio],
    ]);
  }

  adapterFor(provider: ChannelProvider): ProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new BadRequestException(`Unsupported channel provider: ${provider}`);
    return adapter;
  }

  /** Decrypts the stored credential blob for a channel. */
  credentialsFor(channel: Channel): ChannelCredentials {
    const key = this.config.get<string>('app.encryptionKey') as string;
    return (decryptJson<Record<string, string>>(channel.credentials, key) ?? {}) as ChannelCredentials;
  }

  providerCatalogue() {
    return [ChannelProvider.SANDBOX, ChannelProvider.META_CLOUD, ChannelProvider.TWILIO].map((provider) => {
      const adapter = this.adapterFor(provider);
      return {
        provider,
        requiresCredentials: adapter.requiresCredentials,
        fields: adapter.credentialSchema(),
      };
    });
  }

  /**
   * Persists an outbound message then hands it to the provider. The row is
   * written first so a provider failure still leaves an auditable record with
   * the error attached.
   */
  async dispatch(input: DispatchInput): Promise<{ id: string; delivered: boolean; error?: string }> {
    const quota = await this.billing.checkMessageQuota(input.channel.orgId);

    const message = await this.prisma.message.create({
      data: {
        orgId: input.channel.orgId,
        conversationId: input.conversationId,
        channelId: input.channel.id,
        direction: 'OUTBOUND',
        source: input.source,
        body: input.text,
        payload: input.buttons?.length ? { buttons: input.buttons } : undefined,
        nodeId: input.nodeId ?? undefined,
        status: quota.allowed ? 'QUEUED' : 'FAILED',
        error: quota.allowed ? undefined : quota.reason,
      },
    });

    if (!quota.allowed) {
      this.logger.warn(`Send blocked for org ${input.channel.orgId}: ${quota.reason}`);
      return { id: message.id, delivered: false, error: quota.reason };
    }

    const started = Date.now();
    try {
      const adapter = this.adapterFor(input.channel.provider);
      const payload: OutboundMessage = { to: input.to, text: input.text, buttons: input.buttons };
      const result = await adapter.send(payload, this.credentialsFor(input.channel));

      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          providerMessageId: result.providerMessageId,
          latencyMs: Date.now() - started,
        },
      });
      await this.billing.meter(input.channel.orgId, 'messagesOut');

      return { id: message.id, delivered: true };
    } catch (error) {
      const reason = (error as Error).message;
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', error: reason.slice(0, 500), latencyMs: Date.now() - started },
      });
      await this.prisma.channel.update({
        where: { id: input.channel.id },
        data: { lastError: reason.slice(0, 500), lastErrorAt: new Date(), status: 'ERROR' },
      });
      this.logger.error(`Dispatch failed on channel ${input.channel.id}: ${reason}`);
      return { id: message.id, delivered: false, error: reason };
    }
  }
}
