import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EngineService } from '../engine/engine.service';
import { MessagingService } from '../messaging/messaging.service';
import { ChannelsService } from '../channels/channels.service';
import { AuditService } from '../audit/audit.service';
import { paginate } from '../common/types';

export interface ListConversationsQuery {
  status?: ConversationStatus;
  channelId?: string;
  flowId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: EngineService,
    private readonly messaging: MessagingService,
    private readonly channels: ChannelsService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, query: ListConversationsQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));

    const where: Prisma.ConversationWhereInput = {
      orgId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.channelId ? { channelId: query.channelId } : {}),
      ...(query.flowId ? { flowId: query.flowId } : {}),
      ...(query.search
        ? {
            contact: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { waId: { contains: query.search } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.conversationValue.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contact: { select: { id: true, name: true, waId: true, tags: true } },
          channel: { select: { id: true, name: true, provider: true } },
          flow: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, direction: true, createdAt: true } },
        },
      }),
      this.prisma.conversationValue.count({ where }),
    ]);

    return paginate(
      items.map(({ messages, ...rest }) => ({ ...rest, lastMessage: messages[0] ?? null })),
      total,
      page,
      pageSize,
    );
  }

  async get(orgId: string, id: string) {
    const conversationValue = await this.prisma.conversationValue.findFirst({
      where: { id, orgId },
      include: {
        contact: true,
        channel: { select: { id: true, name: true, provider: true } },
        flow: { select: { id: true, name: true, status: true } },
      },
    });
    if (!conversationValue) throw new NotFoundException('Conversation not found');

    const messages = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    return { ...conversationValue, messages };
  }

  /** Messages after a cursor - powers the inbox's lightweight live polling. */
  async messagesSince(orgId: string, id: string, since?: string) {
    const conversationValue = await this.prisma.conversationValue.findFirst({
      where: { id, orgId },
      select: { id: true, status: true, currentNodeId: true },
    });
    if (!conversationValue) throw new NotFoundException('Conversation not found');

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return { status: conversationValue.status, currentNodeId: conversationValue.currentNodeId, messages };
  }

  /** A human agent replying inside the shared inbox. */
  async sendAgentMessage(orgId: string, id: string, text: string, userId: string | null) {
    if (!text?.trim()) throw new BadRequestException('Message cannot be empty');

    const conversationValue = await this.prisma.conversationValue.findFirst({
      where: { id, orgId },
      include: { channel: true, contact: true },
    });
    if (!conversationValue) throw new NotFoundException('Conversation not found');

    const result = await this.messaging.dispatch({
      channel: conversationValue.channel,
      conversationId: conversationValue.id,
      to: conversationValue.contact.waId,
      text: text.trim(),
      source: MessageSource.AGENT,
    });

    await this.prisma.conversationValue.update({
      where: { id },
      data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
    });
    await this.audit.log({ orgId, actorId: userId, action: 'conversation.agent_reply', target: id });

    return result;
  }

  async setStatus(orgId: string, id: string, status: ConversationStatus, userId: string | null) {
    const conversationValue = await this.prisma.conversationValue.findFirst({ where: { id, orgId } });
    if (!conversationValue) throw new NotFoundException('Conversation not found');

    const updated = await this.prisma.conversationValue.update({
      where: { id },
      data: {
        status,
        completedAt: status === ConversationStatus.COMPLETED ? new Date() : null,
        // Handing back to the bot resumes from wherever the flow left off.
        ...(status === ConversationStatus.ACTIVE ? {} : {}),
      },
    });
    await this.audit.log({ orgId, actorId: userId, action: 'conversation.status_changed', target: id, metadata: { status } });
    return updated;
  }

  /**
   * Drives the built-in simulator. Uses the same engine as a real webhook, so
   * what you see here is exactly what a WhatsApp contact would receive.
   */
  async simulate(orgId: string, input: { waId?: string; text: string; profileName?: string; channelId?: string }) {
    if (!input.text?.trim()) throw new BadRequestException('Message cannot be empty');

    const channel = input.channelId
      ? await this.prisma.channel.findFirst({ where: { id: input.channelId, orgId } })
      : await this.channels.sandboxChannel(orgId);
    if (!channel) throw new NotFoundException('Channel not found');

    const waId = input.waId?.trim() || '+15550000001';
    const result = await this.engine.handleInbound(channel, {
      waId,
      text: input.text.trim(),
      profileName: input.profileName ?? 'Simulator',
      timestamp: new Date(),
    });

    const messages = await this.prisma.message.findMany({
      where: { conversationId: result.conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return { ...result, channelId: channel.id, waId, messages };
  }

  /** Wipes a simulated session so the tester can start over. */
  async resetSimulator(orgId: string, waId: string) {
    const contact = await this.prisma.contact.findUnique({ where: { orgId_waId: { orgId, waId } } });
    if (!contact) return { success: true };

    await this.prisma.conversationValue.updateMany({
      where: { orgId, contactId: contact.id, status: { in: [ConversationStatus.ACTIVE, ConversationStatus.HANDOFF] } },
      data: { status: ConversationStatus.ABANDONED },
    });
    return { success: true };
  }
}
