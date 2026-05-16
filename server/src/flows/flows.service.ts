import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConversationStatus, Flow, FlowStatus, MessageSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { GeminiService } from '../ai/gemini.service';
import { RedisService } from '../redis/redis.service';
import { asGraph, FlowGraph, validateGraph } from '../engine/graph.types';
import { FLOW_TEMPLATES, templateByKey, templateSummaries } from './flow-templates';
import { CreateFlowDto, GenerateFlowDto, UpdateFlowDto } from './dto/flow.dto';

@Injectable()
export class FlowsService {
  private readonly logger = new Logger(FlowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
    private readonly gemini: GeminiService,
    private readonly redis: RedisService,
  ) {}

  templates() {
    return templateSummaries();
  }

  template(key: string) {
    const template = templateByKey(key);
    if (!template) throw new NotFoundException(`No template named "${key}"`);
    return template;
  }

  async list(orgId: string, includeArchived = false) {
    const flows = await this.prisma.flow.findMany({
      where: { orgId, ...(includeArchived ? {} : { status: { not: FlowStatus.ARCHIVED } }) },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      include: {
        _count: { select: { conversations: true, versions: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return flows.map((flow) => ({
      ...flow,
      nodeCount: asGraph(flow.graph).nodes.length,
      issues: validateGraph(asGraph(flow.graph)).filter((i) => i.level === 'error').length,
    }));
  }

  async get(orgId: string, id: string) {
    const flow = await this.prisma.flow.findFirst({
      where: { id, orgId },
      include: {
        createdBy: { select: { id: true, name: true } },
        channels: { select: { id: true, name: true, provider: true } },
      },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    return { ...flow, issues: validateGraph(asGraph(flow.graph)) };
  }

  async create(orgId: string, userId: string | null, dto: CreateFlowDto) {
    await this.billing.assertCanCreate(orgId, 'flows');

    let graph: FlowGraph = (dto.graph as unknown as FlowGraph) ?? { nodes: [], edges: [] };
    let aiPersona: string | undefined;
    let triggerKeywords: string[] = [];

    if (dto.templateKey) {
      const template = this.template(dto.templateKey);
      graph = template.graph;
      aiPersona = template.aiPersona;
      triggerKeywords = template.triggerKeywords;
    }

    if (!graph.nodes.length) {
      // A blank flow still gets a Start node so the canvas is never empty.
      graph = {
        nodes: [{ id: 'start', type: 'start', position: { x: 80, y: 200 }, data: { label: 'Start' } }],
        edges: [],
      };
    }

    const isFirst = (await this.prisma.flow.count({ where: { orgId } })) === 0;

    const flow = await this.prisma.flow.create({
      data: {
        orgId,
        name: dto.name,
        description: dto.description,
        graph: graph as unknown as Prisma.InputJsonValue,
        aiPersona,
        triggerKeywords,
        createdById: userId,
        isDefault: isFirst,
      },
    });

    await this.audit.log({ orgId, actorId: userId, action: 'flow.created', target: flow.id, metadata: { name: flow.name } });
    return flow;
  }

  async update(orgId: string, id: string, userId: string | null, dto: UpdateFlowDto) {
    const existing = await this.prisma.flow.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Flow not found');

    // Only one default flow per workspace.
    if (dto.isDefault) {
      await this.prisma.flow.updateMany({ where: { orgId, isDefault: true }, data: { isDefault: false } });
    }

    const flow = await this.prisma.flow.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        graph: dto.graph as Prisma.InputJsonValue | undefined,
        triggerKeywords: dto.triggerKeywords,
        aiEnabled: dto.aiEnabled,
        aiPersona: dto.aiPersona,
        fallbackMessage: dto.fallbackMessage,
        isDefault: dto.isDefault,
        status: dto.status,
      },
    });

    await this.audit.log({ orgId, actorId: userId, action: 'flow.updated', target: id });
    await this.redis.delByPrefix(`flow:${id}`);
    return flow;
  }

  /**
   * Publishing snapshots the current graph as an immutable version and bumps
   * the flow's version counter, so a live conversation can never be broken by
   * an in-progress edit.
   */
  async publish(orgId: string, id: string, userId: string | null, notes?: string) {
    const flow = await this.prisma.flow.findFirst({ where: { id, orgId } });
    if (!flow) throw new NotFoundException('Flow not found');

    const graph = asGraph(flow.graph);
    const issues = validateGraph(graph);
    const errors = issues.filter((i) => i.level === 'error');
    if (errors.length) {
      throw new BadRequestException({
        message: 'Fix the following before publishing',
        error: 'FlowValidationFailed',
        issues: errors,
      });
    }

    const nextVersion = flow.version + 1;
    const [, published] = await this.prisma.$transaction([
      this.prisma.flowVersion.create({
        data: { flowId: id, version: nextVersion, graph: flow.graph as Prisma.InputJsonValue, notes },
      }),
      this.prisma.flow.update({
        where: { id },
        data: { status: FlowStatus.PUBLISHED, version: nextVersion, publishedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      orgId,
      actorId: userId,
      action: 'flow.published',
      target: id,
      metadata: { version: nextVersion },
    });
    return { ...published, warnings: issues.filter((i) => i.level === 'warning') };
  }

  async versions(orgId: string, id: string) {
    const flow = await this.prisma.flow.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!flow) throw new NotFoundException('Flow not found');
    return this.prisma.flowVersion.findMany({
      where: { flowId: id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, notes: true, createdAt: true },
    });
  }

  async restore(orgId: string, id: string, version: number, userId: string | null) {
    const snapshot = await this.prisma.flowVersion.findFirst({
      where: { flowId: id, version, flow: { orgId } },
    });
    if (!snapshot) throw new NotFoundException('That version does not exist');

    const flow = await this.prisma.flow.update({
      where: { id },
      data: { graph: snapshot.graph as Prisma.InputJsonValue, status: FlowStatus.DRAFT },
    });
    await this.audit.log({ orgId, actorId: userId, action: 'flow.restored', target: id, metadata: { version } });
    return flow;
  }

  async remove(orgId: string, id: string, userId: string | null) {
    const flow = await this.prisma.flow.findFirst({ where: { id, orgId } });
    if (!flow) throw new NotFoundException('Flow not found');

    // Archive rather than delete - conversations reference the flow.
    await this.prisma.flow.update({ where: { id }, data: { status: FlowStatus.ARCHIVED, isDefault: false } });
    await this.audit.log({ orgId, actorId: userId, action: 'flow.archived', target: id });
    return { success: true };
  }

  async duplicate(orgId: string, id: string, userId: string | null) {
    await this.billing.assertCanCreate(orgId, 'flows');
    const source = await this.prisma.flow.findFirst({ where: { id, orgId } });
    if (!source) throw new NotFoundException('Flow not found');

    return this.prisma.flow.create({
      data: {
        orgId,
        name: `${source.name} (copy)`,
        description: source.description,
        graph: source.graph as Prisma.InputJsonValue,
        triggerKeywords: source.triggerKeywords,
        aiEnabled: source.aiEnabled,
        aiPersona: source.aiPersona,
        fallbackMessage: source.fallbackMessage,
        createdById: userId,
      },
    });
  }

  validate(graph: unknown) {
    return { issues: validateGraph(asGraph(graph)) };
  }

  // -- AI generation ---------------------------------------------------------

  /**
   * Asks Gemini for a conversation design, then lays it out deterministically.
   * The model only supplies structure; positions and edge wiring are computed
   * here so the result is always a valid, renderable graph.
   */
  async generate(orgId: string, dto: GenerateFlowDto): Promise<{ graph: FlowGraph; aiPersona: string }> {
    if (!this.gemini.enabled) {
      throw new BadRequestException(
        'AI flow generation needs GEMINI_API_KEY to be set on the server. You can still start from a template.',
      );
    }
    const quota = await this.billing.checkAiQuota(orgId);
    if (!quota.allowed) throw new BadRequestException(quota.reason);

    const schema = `{
  "persona": "one sentence describing how the bot should speak",
  "steps": [
    { "kind": "message", "label": "short label", "text": "what the bot says" },
    { "kind": "question", "label": "short label", "text": "the question", "variable": "snake_case_name", "options": ["A", "B", "C"] },
    { "kind": "capture", "label": "short label", "text": "prompt for free text", "variable": "snake_case_name" },
    { "kind": "end", "label": "short label", "text": "closing message" }
  ]
}`;

    const prompt = `Design a WhatsApp conversation flow.

Business: ${dto.businessName}
What they do: ${dto.businessDescription}
${dto.goal ? `Goal of the conversation: ${dto.goal}` : ''}

Rules:
- Between 5 and 8 steps.
- The first step must be a "message" that greets the contact.
- Use 2 to 4 "question" steps with exactly 3 short options each (max 20 characters per option).
- Include at least one "capture" step for a phone number, email, or free-text detail.
- The last step must be "end".
- Reference earlier answers with {{variable_name}} where it reads naturally.
- Reply with JSON matching this schema exactly, no commentary:
${schema}`;

    const result = await this.gemini.generateJson<{
      persona?: string;
      steps?: Array<{ kind: string; label?: string; text?: string; variable?: string; options?: string[] }>;
    }>([{ role: 'user', text: prompt }], { temperature: 0.8, maxOutputTokens: 8192 });

    await this.billing.meter(orgId, 'aiCalls');

    const steps = (result.steps ?? []).filter((s) => s && typeof s.kind === 'string');
    if (!steps.length) throw new BadRequestException('The AI did not return a usable flow. Try again.');

    return { graph: this.layout(steps), aiPersona: result.persona?.trim() || `You are the WhatsApp assistant for ${dto.businessName}.` };
  }

  /** Turns a linear step list into a positioned, fully wired graph. */
  private layout(
    steps: Array<{ kind: string; label?: string; text?: string; variable?: string; options?: string[] }>,
  ): FlowGraph {
    const nodes: FlowGraph['nodes'] = [
      { id: 'start', type: 'start', position: { x: 40, y: 220 }, data: { label: 'Start' } },
    ];
    const edges: FlowGraph['edges'] = [];

    const COL = 340;
    const allowed = new Set(['message', 'question', 'capture', 'ai', 'end']);

    let previousId = 'start';
    steps.forEach((step, index) => {
      const kind = allowed.has(step.kind) ? step.kind : 'message';
      const id = `n${index + 1}`;
      const options = (step.options ?? []).slice(0, 3).map((o) => String(o).slice(0, 20));

      nodes.push({
        id,
        type: kind,
        position: { x: (index + 1) * COL + 40, y: 220 + (index % 2 === 0 ? 0 : 90) },
        data: {
          label: (step.label ?? kind).slice(0, 40),
          text: step.text ?? '',
          ...(kind === 'question' ? { responses: options.length ? options : ['Yes', 'No', 'Tell me more'] } : {}),
          ...(step.variable ? { variable: step.variable.replace(/[^\w]/g, '_') } : {}),
        },
      });

      // A question fans out from each option handle; everything else is linear.
      const previous = nodes.find((n) => n.id === previousId);
      if (previous?.type === 'question') {
        (previous.data.responses ?? []).forEach((label, optionIndex) => {
          edges.push({
            id: `e-${previousId}-${optionIndex}-${id}`,
            source: previousId,
            target: id,
            sourceHandle: `response-${optionIndex}`,
            label,
          });
        });
      } else {
        edges.push({ id: `e-${previousId}-${id}`, source: previousId, target: id });
      }
      previousId = id;
    });

    // Guarantee a terminal node so conversations can complete.
    const last = nodes[nodes.length - 1];
    if (last.type !== 'end') {
      const endId = 'end';
      nodes.push({
        id: endId,
        type: 'end',
        position: { x: last.position.x + COL, y: 220 },
        data: { label: 'End', text: 'Thanks for chatting - we will be in touch shortly!' },
      });
      if (last.type === 'question') {
        (last.data.responses ?? []).forEach((label, optionIndex) => {
          edges.push({
            id: `e-${last.id}-${optionIndex}-${endId}`,
            source: last.id,
            target: endId,
            sourceHandle: `response-${optionIndex}`,
            label,
          });
        });
      } else {
        edges.push({ id: `e-${last.id}-${endId}`, source: last.id, target: endId });
      }
    }

    return { nodes, edges };
  }

  // -- builder preview -------------------------------------------------------

  /**
   * Dry-run of a flow that never touches a provider or the tenant's real
   * conversation history - used by the builder's preview pane.
   */
  async preview(
    orgId: string,
    flowId: string,
    history: Array<{ role: 'user' | 'bot'; text: string }>,
    message: string,
  ) {
    const flow = await this.prisma.flow.findFirst({ where: { id: flowId, orgId } });
    if (!flow) throw new NotFoundException('Flow not found');
    return this.simulateGraph(flow, history, message);
  }

  /**
   * Stateless walk over the graph. Replays the transcript from the start node
   * each call, which keeps the preview endpoint free of any stored session.
   */
  private simulateGraph(
    flow: Flow,
    history: Array<{ role: 'user' | 'bot'; text: string }>,
    message: string,
  ): { replies: Array<{ text: string; buttons?: string[] }>; status: ConversationStatus } {
    const graph = asGraph(flow.graph);
    const userTurns = [...history.filter((h) => h.role === 'user').map((h) => h.text), message];

    const variables: Record<string, unknown> = { contactName: 'Preview user', contactPhone: '+10000000000' };
    const replies: Array<{ text: string; buttons?: string[] }> = [];

    const start = graph.nodes.find((n) => n.type === 'start');
    if (!start) return { replies: [{ text: flow.fallbackMessage }], status: ConversationStatus.ACTIVE };

    let cursor: string | null = graph.edges.find((e) => e.source === start.id)?.target ?? null;
    let turnIndex = 0;
    let guard = 0;
    let status: ConversationStatus = ConversationStatus.ACTIVE;

    const interpolate = (text: string) =>
      (text ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => String(variables[key] ?? ''));

    while (cursor && guard++ < 60) {
      const node = graph.nodes.find((n) => n.id === cursor);
      if (!node) break;

      if (node.type === 'message' || node.type === 'ai') {
        replies.push({ text: interpolate(node.data.text ?? node.data.aiPrompt ?? node.data.label) });
        cursor = graph.edges.find((e) => e.source === node.id)?.target ?? null;
        continue;
      }

      if (node.type === 'end' || node.type === 'handoff') {
        if (node.data.text) replies.push({ text: interpolate(node.data.text) });
        status = node.type === 'end' ? ConversationStatus.COMPLETED : ConversationStatus.HANDOFF;
        cursor = null;
        continue;
      }

      if (node.type === 'condition') {
        const rules = node.data.conditions ?? [];
        let next: string | null = null;
        for (let i = 0; i < rules.length; i += 1) {
          const rule = rules[i];
          const actual = String(variables[rule.variable] ?? '').toLowerCase();
          const expected = (rule.value ?? '').toLowerCase();
          const hit =
            (rule.operator === 'equals' && actual === expected) ||
            (rule.operator === 'contains' && actual.includes(expected)) ||
            (rule.operator === 'is_not_empty' && actual.length > 0);
          if (hit) {
            next = graph.edges.find((e) => e.source === node.id && e.sourceHandle === `condition-${i}`)?.target ?? null;
            break;
          }
        }
        cursor =
          next ??
          graph.edges.find((e) => e.source === node.id && e.sourceHandle === 'condition-else')?.target ??
          graph.edges.find((e) => e.source === node.id)?.target ??
          null;
        continue;
      }

      // question / capture - consume the next user turn, or stop and wait.
      const answer = userTurns[turnIndex];
      if (answer === undefined) {
        replies.push({
          text: interpolate(node.data.text ?? node.data.label),
          buttons: node.type === 'question' ? node.data.responses : undefined,
        });
        break;
      }
      turnIndex += 1;

      if (node.type === 'question') {
        const options = node.data.responses ?? [];
        const index = options.findIndex((o) => o.toLowerCase() === answer.trim().toLowerCase());
        const resolved = index === -1 ? Number.parseInt(answer, 10) - 1 : index;
        const chosen = options[resolved] ?? options[0] ?? answer;
        if (node.data.variable) variables[node.data.variable] = chosen;
        cursor =
          graph.edges.find((e) => e.source === node.id && e.sourceHandle === `response-${resolved >= 0 ? resolved : 0}`)
            ?.target ??
          graph.edges.find((e) => e.source === node.id)?.target ??
          null;
      } else {
        if (node.data.variable) variables[node.data.variable] = answer;
        cursor = graph.edges.find((e) => e.source === node.id)?.target ?? null;
      }
    }

    return { replies, status };
  }

  /** Seeds a brand new workspace with a couple of ready-to-run flows. */
  async seedStarterFlows(orgId: string, userId: string | null): Promise<void> {
    const keys = ['faq_support', 'lead_gen'];
    for (const [index, key] of keys.entries()) {
      const template = templateByKey(key);
      if (!template) continue;
      await this.prisma.flow.create({
        data: {
          orgId,
          name: template.name,
          description: template.description,
          graph: template.graph as unknown as Prisma.InputJsonValue,
          aiPersona: template.aiPersona,
          triggerKeywords: template.triggerKeywords,
          status: FlowStatus.PUBLISHED,
          publishedAt: new Date(),
          isDefault: index === 0,
          createdById: userId,
        },
      });
    }
  }

  allTemplates() {
    return FLOW_TEMPLATES;
  }
}


// TODO: extract this into a shared helper
// TODO: replace the any casts with real types
// FIXME: blows up on an empty payload