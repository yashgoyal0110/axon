import { Injectable } from '@nestjs/common';
import { ConversationStatus, MessageSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { asGraph } from '../engine/graph.types';

export interface OverviewMetrics {
  range: { from: string; to: string; days: number };
  totals: {
    conversations: number;
    conversationsCompleted: number;
    messagesIn: number;
    messagesOut: number;
    aiReplies: number;
    contacts: number;
    activeNow: number;
  };
  rates: {
    completionRate: number;
    aiDeflectionRate: number;
    handoffRate: number;
    avgMessagesPerConversation: number;
    avgResponseMs: number;
  };
  deltas: { conversations: number; messages: number; completionRate: number };
  series: Array<{
    date: string;
    messagesIn: number;
    messagesOut: number;
    conversationsStarted: number;
    conversationsCompleted: number;
    aiCalls: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async overview(orgId: string, days = 30): Promise<OverviewMetrics> {
    const window = Math.min(365, Math.max(1, days));
    const cacheKey = `analytics:overview:${orgId}:${window}`;
    const cached = await this.redis.getJson<OverviewMetrics>(cacheKey);
    if (cached) return cached;

    const to = new Date();
    const from = new Date(to.getTime() - window * 24 * 60 * 60 * 1000);
    // Same-length window immediately before, for period-over-period deltas.
    const prevFrom = new Date(from.getTime() - window * 24 * 60 * 60 * 1000);

    const [
      conversations,
      completed,
      handoffs,
      messagesIn,
      messagesOut,
      aiReplies,
      contacts,
      activeNow,
      prevConversations,
      prevMessages,
      prevCompleted,
      latency,
      stats,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { orgId, startedAt: { gte: from } } }),
      this.prisma.conversation.count({
        where: { orgId, startedAt: { gte: from }, status: ConversationStatus.COMPLETED },
      }),
      this.prisma.conversation.count({
        where: { orgId, startedAt: { gte: from }, status: ConversationStatus.HANDOFF },
      }),
      this.prisma.message.count({ where: { orgId, direction: 'INBOUND', createdAt: { gte: from } } }),
      this.prisma.message.count({ where: { orgId, direction: 'OUTBOUND', createdAt: { gte: from } } }),
      this.prisma.message.count({ where: { orgId, source: MessageSource.AI, createdAt: { gte: from } } }),
      this.prisma.contact.count({ where: { orgId } }),
      this.prisma.conversation.count({ where: { orgId, status: ConversationStatus.ACTIVE } }),
      this.prisma.conversation.count({ where: { orgId, startedAt: { gte: prevFrom, lt: from } } }),
      this.prisma.message.count({ where: { orgId, createdAt: { gte: prevFrom, lt: from } } }),
      this.prisma.conversation.count({
        where: { orgId, startedAt: { gte: prevFrom, lt: from }, status: ConversationStatus.COMPLETED },
      }),
      this.prisma.message.aggregate({
        where: { orgId, direction: 'OUTBOUND', createdAt: { gte: from }, latencyMs: { not: null } },
        _avg: { latencyMs: true },
      }),
      this.prisma.dailyStat.findMany({
        where: { orgId, date: { gte: from } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const completionRate = conversations ? Math.round((completed / conversations) * 100) : 0;
    const prevCompletionRate = prevConversations ? Math.round((prevCompleted / prevConversations) * 100) : 0;
    const totalMessages = messagesIn + messagesOut;

    // Fill gaps so the chart has a point for every day in the window.
    const byDate = new Map(stats.map((s) => [s.date.toISOString().slice(0, 10), s]));
    const series: OverviewMetrics['series'] = [];
    for (let i = window - 1; i >= 0; i -= 1) {
      const day = new Date(to.getTime() - i * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      const stat = byDate.get(key);
      series.push({
        date: key,
        messagesIn: stat?.messagesIn ?? 0,
        messagesOut: stat?.messagesOut ?? 0,
        conversationsStarted: stat?.conversationsStarted ?? 0,
        conversationsCompleted: stat?.conversationsCompleted ?? 0,
        aiCalls: stat?.aiCalls ?? 0,
      });
    }

    const result: OverviewMetrics = {
      range: { from: from.toISOString(), to: to.toISOString(), days: window },
      totals: {
        conversations,
        conversationsCompleted: completed,
        messagesIn,
        messagesOut,
        aiReplies,
        contacts,
        activeNow,
      },
      rates: {
        completionRate,
        aiDeflectionRate: messagesOut ? Math.round((aiReplies / messagesOut) * 100) : 0,
        handoffRate: conversations ? Math.round((handoffs / conversations) * 100) : 0,
        avgMessagesPerConversation: conversations ? Math.round((totalMessages / conversations) * 10) / 10 : 0,
        avgResponseMs: Math.round(latency._avg.latencyMs ?? 0),
      },
      deltas: {
        conversations: this.percentDelta(conversations, prevConversations),
        messages: this.percentDelta(totalMessages, prevMessages),
        completionRate: completionRate - prevCompletionRate,
      },
      series,
    };

    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }

  /**
   * Per-node traffic for one flow: how many conversations reached each step and
   * where they stopped. This is the view that tells an operator which question
   * is losing people.
   */
  async funnel(orgId: string, flowId: string, days = 30) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const flow = await this.prisma.flow.findFirst({ where: { id: flowId, orgId } });
    if (!flow) return { nodes: [], totalConversations: 0 };

    const graph = asGraph(flow.graph);

    const [reached, stuck, totalConversations] = await Promise.all([
      this.prisma.message.groupBy({
        by: ['nodeId'],
        where: { orgId, direction: 'OUTBOUND', nodeId: { not: null }, createdAt: { gte: from } },
        _count: true,
      }),
      this.prisma.conversation.groupBy({
        by: ['currentNodeId'],
        where: { orgId, flowId, currentNodeId: { not: null }, startedAt: { gte: from } },
        _count: true,
      }),
      this.prisma.conversation.count({ where: { orgId, flowId, startedAt: { gte: from } } }),
    ]);

    const reachedBy = new Map(reached.map((r) => [r.nodeId as string, r._count]));
    const stuckBy = new Map(stuck.map((r) => [r.currentNodeId as string, r._count]));

    const nodes = graph.nodes
      .filter((n) => n.type !== 'start')
      .map((node) => {
        const hits = reachedBy.get(node.id) ?? 0;
        return {
          id: node.id,
          label: node.data?.label ?? node.id,
          type: node.type,
          reached: hits,
          waiting: stuckBy.get(node.id) ?? 0,
          reachRate: totalConversations ? Math.round((hits / totalConversations) * 100) : 0,
        };
      })
      .sort((a, b) => b.reached - a.reached);

    return { nodes, totalConversations };
  }

  /** Flow-level leaderboard used on the analytics page. */
  async flowPerformance(orgId: string, days = 30) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const flows = await this.prisma.flow.findMany({
      where: { orgId, status: { not: 'ARCHIVED' } },
      select: { id: true, name: true, status: true },
    });

    return Promise.all(
      flows.map(async (flow) => {
        const [started, completed, handoff, messages] = await Promise.all([
          this.prisma.conversation.count({ where: { orgId, flowId: flow.id, startedAt: { gte: from } } }),
          this.prisma.conversation.count({
            where: { orgId, flowId: flow.id, startedAt: { gte: from }, status: ConversationStatus.COMPLETED },
          }),
          this.prisma.conversation.count({
            where: { orgId, flowId: flow.id, startedAt: { gte: from }, status: ConversationStatus.HANDOFF },
          }),
          this.prisma.message.count({
            where: { orgId, createdAt: { gte: from }, conversation: { flowId: flow.id } },
          }),
        ]);

        return {
          ...flow,
          started,
          completed,
          handoff,
          messages,
          completionRate: started ? Math.round((completed / started) * 100) : 0,
        };
      }),
    );
  }

  /** Channel mix - which connection is carrying the volume. */
  async channelBreakdown(orgId: string, days = 30) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const channels = await this.prisma.channel.findMany({
      where: { orgId },
      select: { id: true, name: true, provider: true, status: true },
    });

    return Promise.all(
      channels.map(async (channel) => {
        const [messages, conversations, failed] = await Promise.all([
          this.prisma.message.count({ where: { orgId, channelId: channel.id, createdAt: { gte: from } } }),
          this.prisma.conversation.count({ where: { orgId, channelId: channel.id, startedAt: { gte: from } } }),
          this.prisma.message.count({
            where: { orgId, channelId: channel.id, status: 'FAILED', createdAt: { gte: from } },
          }),
        ]);
        return { ...channel, messages, conversations, failed };
      }),
    );
  }

  private percentDelta(current: number, previous: number): number {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}
