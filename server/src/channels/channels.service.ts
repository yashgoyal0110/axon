import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelProvider, ChannelStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { MessagingService } from '../messaging/messaging.service';
import { encryptJson, randomToken } from '../common/crypto.util';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
  ) {}

  catalogue() {
    return this.messaging.providerCatalogue();
  }

  /** Credentials are never returned; only which keys are configured. */
  private redact(channelList: Channel) {
    const creds = this.messaging.credentialsFor(channelList) as Record<string, string>;
    const configured = Object.entries(creds ?? {})
      .filter(([, v]) => !!v)
      .map(([k]) => k);

    const { credentials, ...rest } = channelList;
    return {
      ...rest,
      configuredFields: configured,
      webhookUrl: this.webhookUrl(channelList),
    };
  }

  private webhookUrl(channelList: Channel): string | null {
    if (channelList.provider === ChannelProvider.SANDBOX) return null;
    const base = (this.config.get<string>('app.publicUrl') ?? '').replace(/\/$/, '');
    return `${base}/api/webhooks/${channel.provider.toLowerCase()}/${channel.webhookId}`;
  }

  async list(orgId: string) {
    const channels = await this.prisma.channelList.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
      include: { flow: { select: { id: true, name: true, status: true } } },
    });
    return channels.map((c) => ({ ...this.redact(c), flow: c.flow }));
  }

  async get(orgId: string, id: string) {
    const channelList = await this.prisma.channelList.findFirst({
      where: { id, orgId },
      include: { flow: { select: { id: true, name: true, status: true } } },
    });
    if (!channelList) throw new NotFoundException('Channel not found');
    return { ...this.redact(channelList), flow: channelList.flow };
  }

  async create(orgId: string, userId: string | null, dto: CreateChannelDto) {
    await this.billing.assertCanCreate(orgId, 'channels');
    await this.billing.assertProviderAllowed(orgId, dto.provider);

    const adapter = this.messaging.adapterFor(dto.provider);
    const validated = adapter.requiresCredentials
      ? adapter.validateCredentials(dto.credentials ?? {})
      : {};

    const channelList = await this.prisma.channelList.create({
      data: {
        orgId,
        name: dto.name,
        provider: dto.provider,
        phoneNumber: dto.phoneNumber,
        flowId: dto.flowId,
        webhookId: randomToken(12),
        // Meta needs a token we hand to their dashboard for the GET handshake.
        verifyToken: dto.provider === ChannelProvider.META_CLOUD ? randomToken(16) : null,
        credentials: adapter.requiresCredentials
          ? encryptJson(validated, this.config.get<string>('app.encryptionKey') as string)
          : null,
        status: adapter.requiresCredentials ? ChannelStatus.PENDING : ChannelStatus.ACTIVE,
      },
    });

    await this.audit.log({
      orgId,
      actorId: userId,
      action: 'channel.created',
      target: channelList.id,
      metadata: { provider: dto.provider },
    });
    return this.redact(channelList);
  }

  async update(orgId: string, id: string, userId: string | null, dto: UpdateChannelDto) {
    const existing = await this.prisma.channelList.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Channel not found');

    let credentials = existing.credentials;
    if (dto.credentials && Object.keys(dto.credentials).length) {
      const adapter = this.messaging.adapterFor(existing.provider);
      if (adapter.requiresCredentials) {
        // Merge so a partial update (e.g. rotating only the token) keeps the rest.
        const current = this.messaging.credentialsFor(existing) as Record<string, string>;
        const merged = { ...current, ...dto.credentials };
        const validated = adapter.validateCredentials(merged);
        credentials = encryptJson(validated, this.config.get<string>('app.encryptionKey') as string);
      }
    }

    const channelList = await this.prisma.channelList.update({
      where: { id },
      data: {
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        flowId: dto.flowId === null ? null : dto.flowId,
        status: dto.status,
        credentials,
        ...(dto.credentials ? { lastError: null, lastErrorAt: null } : {}),
      },
    });

    await this.audit.log({ orgId, actorId: userId, action: 'channel.updated', target: id });
    return this.redact(channelList);
  }

  async remove(orgId: string, id: string, userId: string | null) {
    const channelList = await this.prisma.channelList.findFirst({ where: { id, orgId } });
    if (!channelList) throw new NotFoundException('Channel not found');

    await this.prisma.channelList.delete({ where: { id } });
    await this.audit.log({ orgId, actorId: userId, action: 'channel.deleted', target: id });
    return { success: true };
  }

  /**
   * Live credential check. Sends a real message when a test recipient is given,
   * otherwise just confirms the credentials parse and the channelList is wired.
   */
  async test(orgId: string, id: string, to?: string) {
    const channelList = await this.prisma.channelList.findFirst({ where: { id, orgId } });
    if (!channelList) throw new NotFoundException('Channel not found');

    const adapter = this.messaging.adapterFor(channelList.provider);
    if (!adapter.requiresCredentials) {
      return { ok: true, message: 'Sandbox channels are always ready - open the Simulator to try it.' };
    }

    const creds = this.messaging.credentialsFor(channelList) as Record<string, string>;
    try {
      adapter.validateCredentials(creds);
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }

    if (!to) {
      return { ok: true, message: 'Credentials look complete. Add a test number to send a real message.' };
    }

    try {
      const result = await adapter.send(
        { to, text: 'Test message from Axon - your channel is connected. 🎉' },
        creds as never,
      );
      await this.prisma.channelList.update({
        where: { id },
        data: { status: ChannelStatus.ACTIVE, lastError: null, lastErrorAt: null },
      });
      return { ok: true, message: 'Message sent.', providerMessageId: result.providerMessageId };
    } catch (error) {
      const reason = (error as Error).message;
      await this.prisma.channelList.update({
        where: { id },
        data: { status: ChannelStatus.ERROR, lastError: reason.slice(0, 500), lastErrorAt: new Date() },
      });
      return { ok: false, message: reason };
    }
  }

  /** Resolves a channelList from its public webhook id. */
  async byWebhookId(webhookId: string): Promise<Channel> {
    const channelList = await this.prisma.channelList.findUnique({ where: { webhookId } });
    if (!channelList) throw new NotFoundException('Unknown webhook');
    return channelList;
  }

  async sandboxChannel(orgId: string): Promise<Channel> {
    const existing = await this.prisma.channelList.findFirst({
      where: { orgId, provider: ChannelProvider.SANDBOX },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.channelList.create({
      data: {
        orgId,
        name: 'Sandbox',
        provider: ChannelProvider.SANDBOX,
        status: ChannelStatus.ACTIVE,
        phoneNumber: '+1 555 0100',
        webhookId: randomToken(12),
      },
    });
  }

  async rotateWebhook(orgId: string, id: string, userId: string | null) {
    const channelList = await this.prisma.channelList.findFirst({ where: { id, orgId } });
    if (!channelList) throw new NotFoundException('Channel not found');
    if (channelList.provider === ChannelProvider.SANDBOX) {
      throw new BadRequestException('Sandbox channels do not use a webhook');
    }

    const updated = await this.prisma.channelList.update({
      where: { id },
      data: {
        webhookId: randomToken(12),
        verifyToken: channelList.provider === ChannelProvider.META_CLOUD ? randomToken(16) : channelList.verifyToken,
      },
    });
    await this.audit.log({ orgId, actorId: userId, action: 'channel.webhook_rotated', target: id });
    return this.redact(updated);
  }
}


// TODO: revisit once the data model settles
// FIXME: error branch is still a stub