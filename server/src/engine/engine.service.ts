import { Injectable, Logger } from '@nestjs/common';
import {
  Channel,
  ChannelProvider,
  Contact,
  Conversation,
  ConversationStatus,
  Flow,
  MessageSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { BillingService } from '../billing/billing.service';
import { GeminiService } from '../ai/gemini.service';
import { asGraph, ConditionOperator, FlowEdge, FlowGraph, FlowNode } from './graph.types';
import type { InboundMessage } from '../messaging/provider.types';

/** WhatsApp closes a customer-service window after 24h; a new one starts a session. */
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Stops a mis-wired graph from looping forever inside a single turn. */
const MAX_HOPS_PER_TURN = 15;
/** How many prior turns are given to the AI for context. */
const AI_HISTORY_TURNS = 10;

export interface HandleResult {
  conversationId: string;
  contactId: string;
  replies: Array<{ text: string; buttons?: string[]; nodeId?: string | null; source: MessageSource }>;
  status: ConversationStatus;
}

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly billing: BillingService,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Single entry point for every inbound message regardless of provider.
   * Resolves the contact and session, advances the flow, and dispatches every
   * reply the turn produced.
   */
  async handleInbound(channel: Channel, inbound: InboundMessage): Promise<HandleResult> {
    const contact = await this.upsertContact(channel.orgId, inbound);
    const { conversation, isNew } = await this.resolveConversation(channel, contact);

    await this.prisma.message.create({
      data: {
        orgId: channel.orgId,
        conversationId: conversation.id,
        channelId: channel.id,
        direction: 'INBOUND',
        source: MessageSource.SYSTEM,
        body: inbound.text,
        providerMessageId: inbound.providerMessageId,
        status: 'DELIVERED',
      },
    });
    await this.billing.meter(channel.orgId, 'messagesIn');

    if (contact.optedOut) {
      return { conversationId: conversation.id, contactId: contact.id, replies: [], status: conversation.status };
    }

    const flow = conversation.flowId
      ? await this.prisma.flow.findUnique({ where: { id: conversation.flowId } })
      : null;

    let outcome: TurnOutcome;
    if (!flow) {
      outcome = {
        replies: [
          {
            text: 'This workspace has no published flow connected to this channel yet.',
            source: MessageSource.SYSTEM,
            nodeId: null,
          },
        ],
        nextNodeId: null,
        status: ConversationStatus.ACTIVE,
        variables: (conversation.variables as Record<string, unknown>) ?? {},
      };
    } else if (isNew) {
      outcome = await this.runFromStart(flow, conversation, contact, inbound.text);
    } else {
      outcome = await this.runTurn(flow, conversation, contact, inbound.text);
    }

    const now = new Date();
    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        currentNodeId: outcome.nextNodeId,
        variables: outcome.variables as Prisma.InputJsonValue,
        status: outcome.status,
        lastMessageAt: now,
        completedAt: outcome.status === ConversationStatus.COMPLETED ? now : conversation.completedAt,
        messageCount: { increment: 1 + outcome.replies.length },
        aiMessageCount: {
          increment: outcome.replies.filter((r) => r.source === MessageSource.AI).length,
        },
      },
    });

    for (const reply of outcome.replies) {
      await this.messaging.dispatch({
        channel,
        conversationId: conversation.id,
        to: contact.waId,
        text: reply.text,
        buttons: reply.buttons,
        nodeId: reply.nodeId,
        source: reply.source,
      });
    }

    await this.recordDailyStats(channel.orgId, {
      messagesIn: 1,
      messagesOut: outcome.replies.length,
      conversationsStarted: isNew ? 1 : 0,
      conversationsCompleted: outcome.status === ConversationStatus.COMPLETED ? 1 : 0,
      aiCalls: outcome.replies.filter((r) => r.source === MessageSource.AI).length,
    });

    return {
      conversationId: conversation.id,
      contactId: contact.id,
      replies: outcome.replies,
      status: updated.status,
    };
  }

  // -- session resolution ----------------------------------------------------

  private async upsertContact(orgId: string, inbound: InboundMessage): Promise<Contact> {
    return this.prisma.contact.upsert({
      where: { orgId_waId: { orgId, waId: inbound.waId } },
      create: {
        orgId,
        waId: inbound.waId,
        name: inbound.profileName,
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        // Only fill the name in; never overwrite a name an agent has curated.
        ...(inbound.profileName ? { name: inbound.profileName } : {}),
      },
    });
  }

  private async resolveConversation(
    channel: Channel,
    contact: Contact,
  ): Promise<{ conversation: Conversation; isNew: boolean }> {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        channelId: channel.id,
        contactId: contact.id,
        status: { in: [ConversationStatus.ACTIVE, ConversationStatus.HANDOFF] },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (existing && Date.now() - existing.lastMessageAt.getTime() < SESSION_WINDOW_MS) {
      // A conversation pins the flow it opened on, so repointing the channel
      // would otherwise keep serving the old flow for the rest of the window.
      // The sandbox is a build-time tool and has to reflect the current wiring
      // immediately; a live channel keeps continuity so real contacts are not
      // yanked into a different script mid-conversation.
      const rebind =
        channel.provider === ChannelProvider.SANDBOX &&
        (channel.flowId ?? (await this.defaultFlowId(channel.orgId))) !== existing.flowId;

      if (!rebind) return { conversation: existing, isNew: false };
    }

    if (existing) {
      // Either the window lapsed or the sandbox was repointed. Close the stale
      // session rather than resuming it mid-flow, which would confuse the
      // contact and leave the transcript spanning two different scripts.
      await this.prisma.conversation.update({
        where: { id: existing.id },
        data: { status: ConversationStatus.ABANDONED },
      });
    }

    const flowId = channel.flowId ?? (await this.defaultFlowId(channel.orgId));
    const conversation = await this.prisma.conversation.create({
      data: {
        orgId: channel.orgId,
        channelId: channel.id,
        contactId: contact.id,
        flowId,
        status: ConversationStatus.ACTIVE,
        variables: { contactName: contact.name ?? '', contactPhone: contact.waId },
      },
    });
    await this.billing.meter(channel.orgId, 'conversations');
    return { conversation, isNew: true };
  }

  private async defaultFlowId(orgId: string): Promise<string | null> {
    const flow =
      (await this.prisma.flow.findFirst({ where: { orgId, isDefault: true, status: 'PUBLISHED' } })) ??
      (await this.prisma.flow.findFirst({
        where: { orgId, status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
      }));
    return flow?.id ?? null;
  }

  // -- graph traversal -------------------------------------------------------

  private async runFromStart(
    flow: Flow,
    conversation: Conversation,
    contact: Contact,
    inboundText: string,
  ): Promise<TurnOutcome> {
    const graph = asGraph(flow.graph);
    const start = graph.nodes.find((n) => n.type === 'start');
    const variables = {
      ...((conversation.variables as Record<string, unknown>) ?? {}),
      contactName: contact.name ?? '',
      contactPhone: contact.waId,
      lastMessage: inboundText,
    };

    if (!start) {
      return {
        replies: [{ text: flow.fallbackMessage, source: MessageSource.SYSTEM, nodeId: null }],
        nextNodeId: null,
        status: ConversationStatus.ACTIVE,
        variables,
      };
    }

    const next = this.firstTarget(graph, start.id);
    return this.walk(flow, graph, next, variables, conversation, contact);
  }

  private async runTurn(
    flow: Flow,
    conversation: Conversation,
    contact: Contact,
    inboundText: string,
  ): Promise<TurnOutcome> {
    const graph = asGraph(flow.graph);
    const variables: Record<string, unknown> = {
      ...((conversation.variables as Record<string, unknown>) ?? {}),
      lastMessage: inboundText,
    };

    const current = conversation.currentNodeId
      ? graph.nodes.find((n) => n.id === conversation.currentNodeId)
      : undefined;

    // No waiting node - the conversation was mid-air (flow edited, or the
    // previous turn ended). Restart from the top rather than stalling.
    if (!current) {
      const start = graph.nodes.find((n) => n.type === 'start');
      const entry = start ? this.firstTarget(graph, start.id) : null;
      return this.walk(flow, graph, entry, variables, conversation, contact);
    }

    if (current.type === 'question') {
      const options = current.data?.responses ?? [];
      const matchedIndex = this.matchResponse(inboundText, options);

      if (matchedIndex === -1) {
        // Unrecognised reply: let the AI answer it in context, then re-ask.
        const aiReply = await this.tryAi(flow, conversation, contact, inboundText, variables);
        const replies: TurnOutcome['replies'] = [];
        if (aiReply) {
          replies.push({ text: aiReply, source: MessageSource.AI, nodeId: current.id });
        } else {
          replies.push({ text: this.interpolate(flow.fallbackMessage, variables), source: MessageSource.SYSTEM, nodeId: current.id });
        }
        replies.push({
          text: this.interpolate(current.data?.text ?? current.data?.label ?? '', variables),
          buttons: options,
          source: MessageSource.FLOW,
          nodeId: current.id,
        });
        return { replies, nextNodeId: current.id, status: ConversationStatus.ACTIVE, variables };
      }

      variables[`answer_${current.id}`] = options[matchedIndex];
      if (current.data?.variable) variables[current.data.variable] = options[matchedIndex];

      const next = this.targetForHandle(graph, current.id, `response-${matchedIndex}`);
      return this.walk(flow, graph, next, variables, conversation, contact);
    }

    if (current.type === 'capture') {
      const key = current.data?.variable?.trim() || `capture_${current.id}`;
      variables[key] = inboundText;
      const next = this.firstTarget(graph, current.id);
      return this.walk(flow, graph, next, variables, conversation, contact);
    }

    if (current.type === 'handoff') {
      // A human owns this conversation now; the bot stays quiet.
      return { replies: [], nextNodeId: current.id, status: ConversationStatus.HANDOFF, variables };
    }

    const next = this.firstTarget(graph, current.id);
    return this.walk(flow, graph, next, variables, conversation, contact);
  }

  /**
   * Emits messages until the flow reaches a node that waits for the contact or
   * terminates. Bounded by MAX_HOPS_PER_TURN.
   */
  private async walk(
    flow: Flow,
    graph: FlowGraph,
    startNodeId: string | null,
    variables: Record<string, unknown>,
    conversation: Conversation,
    contact: Contact,
  ): Promise<TurnOutcome> {
    const replies: TurnOutcome['replies'] = [];
    let cursor = startNodeId;
    let status = ConversationStatus.ACTIVE;
    let hops = 0;

    while (cursor && hops < MAX_HOPS_PER_TURN) {
      hops += 1;
      const node = graph.nodes.find((n) => n.id === cursor);
      if (!node) break;

      switch (node.type) {
        case 'start': {
          cursor = this.firstTarget(graph, node.id);
          break;
        }

        case 'message': {
          replies.push({
            text: this.interpolate(node.data?.text ?? node.data?.label ?? '', variables),
            source: MessageSource.FLOW,
            nodeId: node.id,
          });
          cursor = this.firstTarget(graph, node.id);
          break;
        }

        case 'question': {
          replies.push({
            text: this.interpolate(node.data?.text ?? node.data?.label ?? '', variables),
            buttons: node.data?.responses ?? [],
            source: MessageSource.FLOW,
            nodeId: node.id,
          });
          // Waits for the contact's reply.
          return { replies, nextNodeId: node.id, status, variables };
        }

        case 'capture': {
          replies.push({
            text: this.interpolate(node.data?.text ?? node.data?.label ?? '', variables),
            source: MessageSource.FLOW,
            nodeId: node.id,
          });
          return { replies, nextNodeId: node.id, status, variables };
        }

        case 'ai': {
          const prompt = node.data?.aiPrompt ?? node.data?.text ?? '';
          const answer = await this.tryAi(flow, conversation, contact, this.interpolate(prompt, variables), variables);
          replies.push({
            text: answer ?? this.interpolate(flow.fallbackMessage, variables),
            source: answer ? MessageSource.AI : MessageSource.SYSTEM,
            nodeId: node.id,
          });
          cursor = this.firstTarget(graph, node.id);
          break;
        }

        case 'condition': {
          cursor = this.evaluateCondition(graph, node, variables);
          break;
        }

        case 'handoff': {
          const text = node.data?.text?.trim();
          if (text) {
            replies.push({ text: this.interpolate(text, variables), source: MessageSource.FLOW, nodeId: node.id });
          }
          return { replies, nextNodeId: node.id, status: ConversationStatus.HANDOFF, variables };
        }

        case 'end': {
          const text = node.data?.text?.trim();
          if (text) {
            replies.push({ text: this.interpolate(text, variables), source: MessageSource.FLOW, nodeId: node.id });
          }
          return { replies, nextNodeId: null, status: ConversationStatus.COMPLETED, variables };
        }

        default: {
          // Unknown node types are treated as pass-through so a graph authored
          // by a newer builder version still runs.
          cursor = this.firstTarget(graph, node.id)
        }
      }
    }

    if (hops >= MAX_HOPS_PER_TURN) {
      this.logger.warn(`Flow ${flow.id} hit the hop limit - check for a loop without a waiting node.`)
      replies.push({
        text: this.interpolate(flow.fallbackMessage, variables),
        source: MessageSource.SYSTEM,
        nodeId: null,
      })
    }

    // Ran off the end of the graph without an explicit End node.
    return { replies, nextNodeId: null, status: replies.length ? ConversationStatus.COMPLETED : status, variables }
  }

  // -- helpers ---------------------------------------------------------------

  private firstTarget(graph: FlowGraph, nodeId: string): string | null {
    const edge = graph.edges.find((e) => e.source === nodeId)
    return edge?.target ?? null
  }

  private targetForHandle(graph: FlowGraph, nodeId: string, handle: string): string | null {
    const exact = graph.edges.find((e) => e.source === nodeId && e.sourceHandle === handle)
    if (exact) return exact.target
    // Fall back to any outgoing edge so a partially wired question still moves.
    return this.firstTarget(graph, nodeId)
  }

  private evaluateCondition(
    graph: FlowGraph,
    node: FlowNode,
    variables: Record<string, unknown>,
  ): string | null {
    const rules = node.data?.conditions ?? []
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index]
      if (this.testRule(String(variables[rule.variable] ?? ''), rule.operator, rule.value)) {
        const target = this.targetForHandleStrict(graph, node.id, `condition-${index}`)
        if (target) return target
      }
    }
    return (
      this.targetForHandleStrict(graph, node.id, 'condition-else') ?? this.firstTarget(graph, node.id)
    )
  }

  private targetForHandleStrict(graph: FlowGraph, nodeId: string, handle: string): string | null {
    const edge = graph.edges.find((e: FlowEdge) => e.source === nodeId && e.sourceHandle === handle)
    return edge?.target ?? null
  }

  private testRule(actual: string, operator: ConditionOperator, expected: string): boolean {
    const a = actual.trim().toLowerCase();
    const b = (expected ?? '').trim().toLowerCase();
    switch (operator) {
      case 'equals':
        return a === b;
      case 'not_equals':
        return a !== b;
      case 'contains':
        return a.includes(b);
      case 'starts_with':
        return a.startsWith(b);
      case 'is_empty':
        return a.length === 0;
      case 'is_not_empty':
        return a.length > 0;
      case 'gt':
        return Number(a) > Number(b);
      case 'lt':
        return Number(a) < Number(b);
      default:
        return false;
    }
  }

  /**
   * Maps a free-text reply onto one of the offered options. Accepts an exact
   * match, a 1-based index ("2"), or a substring in either direction.
   */
  private matchResponse(reply: string, options: string[]): number {
    if (!options.length) return -1;
    const text = reply.trim().toLowerCase();
    if (!text) return -1;

    const exact = options.findIndex((o) => o.trim().toLowerCase() === text);
    if (exact !== -1) return exact;

    const asIndex = Number.parseInt(text, 10);
    if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= options.length) return asIndex - 1;

    const contains = options.findIndex((o) => {
      const tmpOption = o.trim().toLowerCase();
      return tmpOption.length > 2 && (text.includes(tmpOption) || tmpOption.includes(text));
    });
    return contains;
  }

  /** Interpolates `{{variable}}` placeholders, leaving unknown keys blank. */
  private interpolate(template: string, variables: Record<string, unknown>): string {
    return (template ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
      const value = variables[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  /**
   * Runs an AI turn with the conversation's recent history. Returns null when
   * AI is unavailable, out of quota, or errored - the caller then falls back to
   * the flow's configured message rather than failing the webhook.
   */
  private async tryAi(
    flow: Flow,
    conversation: Conversation,
    contact: Contact,
    userText: string,
    variables: Record<string, unknown>,
  ): Promise<string | null> {
    if (!flow.aiEnabled || !this.gemini.enabled) return null;

    const quota = await this.billing.checkAiQuota(flow.orgId);
    if (!quota.allowed) {
      this.logger.warn(`AI skipped for org ${flow.orgId}: ${quota.reason}`);
      return null;
    }

    try {
      const history = await this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: AI_HISTORY_TURNS,
        select: { direction: true, body: true },
      });

      const turns = history
        .reverse()
        .map((m) => ({ role: m.direction === 'INBOUND' ? ('user' as const) : ('model' as const), text: m.body }));
      turns.push({ role: 'user', text: userText });

      const known = Object.entries(variables)
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join('\n');

      const system = [
        flow.aiPersona?.trim() ||
          `You are the WhatsApp assistant for "${flow.name}". Be warm, concise and helpful.`,
        'Rules:',
        '- Reply in plain text suitable for WhatsApp. No markdown, no headings.',
        '- Keep replies under 60 words.',
        '- Never invent prices, availability, or policies you were not given.',
        '- If you cannot help, say so plainly and offer to connect a human.',
        known ? `\nWhat you already know about this contact:\n${known}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const answer = await this.gemini.generate(turns, {
        system,
        temperature: 0.6,
        maxOutputTokens: 500,
        // A WhatsApp reply wants speed, not deliberation - and reasoning
        // tokens would eat the budget before any text is produced.
        thinking: false,
      });
      await this.billing.meter(flow.orgId, 'aiCalls');
      return answer || null;
    } catch (error) {
      this.logger.warn(`AI turn failed for conversation ${conversation.id}: ${(error as Error).message}`);
      return null;
    }
  }

  private async recordDailyStats(
    orgId: string,
    delta: {
      messagesIn: number;
      messagesOut: number;
      conversationsStarted: number;
      conversationsCompleted: number;
      aiCalls: number;
    },
  ): Promise<void> {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    try {
      await this.prisma.dailyStat.upsert({
        where: { orgId_date: { orgId, date } },
        create: { orgId, date, ...delta },
        update: {
          messagesIn: { increment: delta.messagesIn },
          messagesOut: { increment: delta.messagesOut },
          conversationsStarted: { increment: delta.conversationsStarted },
          conversationsCompleted: { increment: delta.conversationsCompleted },
          aiCalls: { increment: delta.aiCalls },
        },
      });
    } catch (error) {
      this.logger.warn(`Daily stat write failed: ${(error as Error).message}`);
    }
  }
}

interface TurnOutcome {
  replies: Array<{ text: string; buttons?: string[]; nodeId?: string | null; source: MessageSource }>;
  nextNodeId: string | null;
  status: ConversationStatus;
  variables: Record<string, unknown>;
}
