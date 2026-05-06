/**
 * Idempotent seed. Runs on every container start so a fresh deploy is
 * immediately demoable: a workspace, a signed-in-able owner, published flows,
 * a sandbox channel, contacts, conversations and 30 days of analytics.
 */
import {
  ChannelProvider,
  ChannelStatus,
  ConversationStatus,
  FlowStatus,
  MessageDirection,
  MessageSource,
  MessageStatus,
  Plan,
  PlanStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { FLOW_TEMPLATES } from '../src/flows/flow-templates';

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@axon.app';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';
const DEMO_ORG_SLUG = 'acme-support';

function token(bytes = 12): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

async function main(): Promise<void> {
  console.log('→ Seeding Axon…');

  // -- workspace + owner -----------------------------------------------------
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORG_SLUG },
    update: {},
    create: {
      name: 'Acme Support',
      slug: DEMO_ORG_SLUG,
      billingEmail: DEMO_EMAIL,
      plan: Plan.PRO,
      planStatus: PlanStatus.ACTIVE,
      settings: { timezone: 'UTC', brandColor: '#25D366' },
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo Owner',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      emailVerified: true,
    },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: owner.id, orgId: org.id } },
    update: {},
    create: { userId: owner.id, orgId: org.id, role: Role.OWNER },
  });

  // A second seat so the team settings page has something to show.
  const agent = await prisma.user.upsert({
    where: { email: 'agent@axon.app' },
    update: {},
    create: {
      email: 'agent@axon.app',
      name: 'Sam Agent',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      emailVerified: true,
    },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: agent.id, orgId: org.id } },
    update: {},
    create: { userId: agent.id, orgId: org.id, role: Role.AGENT },
  });

  // -- flows -----------------------------------------------------------------
  const existingFlows = await prisma.flow.count({ where: { orgId: org.id } });
  if (existingFlows === 0) {
    for (const [index, template] of FLOW_TEMPLATES.entries()) {
      await prisma.flow.create({
        data: {
          orgId: org.id,
          name: template.name,
          description: template.description,
          graph: template.graph as never,
          aiPersona: template.aiPersona,
          triggerKeywords: template.triggerKeywords,
          status: index < 3 ? FlowStatus.PUBLISHED : FlowStatus.DRAFT,
          publishedAt: index < 3 ? daysAgo(20 - index) : null,
          version: index < 3 ? 2 : 1,
          isDefault: index === 0,
          createdById: owner.id,
        },
      });
    }
    console.log(`  ✓ ${FLOW_TEMPLATES.length} flows`);
  }

  const defaultFlow = await prisma.flow.findFirst({
    where: { orgId: org.id, isDefault: true },
  });

  // -- channels --------------------------------------------------------------
  let sandbox = await prisma.channel.findFirst({
    where: { orgId: org.id, provider: ChannelProvider.SANDBOX },
  });
  if (!sandbox) {
    sandbox = await prisma.channel.create({
      data: {
        orgId: org.id,
        name: 'Sandbox',
        provider: ChannelProvider.SANDBOX,
        status: ChannelStatus.ACTIVE,
        phoneNumber: '+1 555 0100',
        webhookId: token(),
        flowId: defaultFlow?.id,
      },
    });
    console.log('  ✓ sandbox channel');
  }

  // -- contacts + conversations + messages -----------------------------------
  const existingConversations = await prisma.conversation.count({ where: { orgId: org.id } });
  if (existingConversations === 0 && defaultFlow) {
    const people = [
      { waId: '+14155551001', name: 'Priya Nair' },
      { waId: '+14155551002', name: 'Marcus Webb' },
      { waId: '+14155551003', name: 'Lena Fischer' },
      { waId: '+14155551004', name: 'Diego Ramos' },
      { waId: '+14155551005', name: 'Aisha Bello' },
      { waId: '+14155551006', name: 'Tom Okafor' },
      { waId: '+14155551007', name: 'Yuki Tanaka' },
      { waId: '+14155551008', name: 'Sofia Rossi' },
    ];

    const statuses = [
      ConversationStatus.COMPLETED,
      ConversationStatus.COMPLETED,
      ConversationStatus.ACTIVE,
      ConversationStatus.HANDOFF,
      ConversationStatus.ABANDONED,
    ];

    const openers = [
      'hi',
      'hello, I need help',
      'is anyone there?',
      'I have a question about my order',
      'help please',
    ];

    for (const [index, person] of people.entries()) {
      const contact = await prisma.contact.create({
        data: {
          orgId: org.id,
          waId: person.waId,
          name: person.name,
          tags: index % 3 === 0 ? ['vip'] : index % 3 === 1 ? ['new'] : [],
          lastSeenAt: daysAgo(index % 7),
          createdAt: daysAgo(20 - index),
        },
      });

      const status = pick(statuses, index);
      const startedAt = daysAgo((index % 14) + 1);

      const conversation = await prisma.conversation.create({
        data: {
          orgId: org.id,
          channelId: sandbox.id,
          contactId: contact.id,
          flowId: defaultFlow.id,
          status,
          currentNodeId: status === ConversationStatus.ACTIVE ? 'topic' : null,
          variables: { contactName: person.name, contactPhone: person.waId },
          startedAt,
          lastMessageAt: new Date(startedAt.getTime() + 6 * 60 * 1000),
          completedAt: status === ConversationStatus.COMPLETED ? new Date(startedAt.getTime() + 8 * 60 * 1000) : null,
          messageCount: 4,
          aiMessageCount: index % 2,
        },
      });

      const transcript: Array<[MessageDirection, MessageSource, string]> = [
        [MessageDirection.INBOUND, MessageSource.SYSTEM, pick(openers, index)],
        [MessageDirection.OUTBOUND, MessageSource.FLOW, 'Hi! What do you need a hand with?'],
        [MessageDirection.INBOUND, MessageSource.SYSTEM, pick(['Order status', 'Billing question', 'Something else'], index)],
        [
          MessageDirection.OUTBOUND,
          index % 2 === 0 ? MessageSource.FLOW : MessageSource.AI,
          index % 2 === 0
            ? 'Sure - what is your order number?'
            : 'Happy to help with that. Could you share a little more detail?',
        ],
      ];

      for (const [offset, [direction, source, bodyText]] of transcript.entries()) {
        await prisma.message.create({
          data: {
            orgId: org.id,
            conversationId: conversation.id,
            channelId: sandbox.id,
            direction,
            source,
            body: bodyText,
            status: direction === MessageDirection.OUTBOUND ? MessageStatus.SENT : MessageStatus.DELIVERED,
            latencyMs: direction === MessageDirection.OUTBOUND ? 220 + offset * 45 : null,
            nodeId: direction === MessageDirection.OUTBOUND ? (offset === 1 ? 'topic' : 'orderId') : null,
            createdAt: new Date(startedAt.getTime() + offset * 90 * 1000),
          },
        });
      }
    }
    console.log(`  ✓ ${people.length} contacts with transcripts`);
  }

  // -- analytics history -----------------------------------------------------
  const statCount = await prisma.dailyStat.count({ where: { orgId: org.id } });
  if (statCount === 0) {
    for (let i = 29; i >= 0; i -= 1) {
      const date = daysAgo(i);
      date.setUTCHours(0, 0, 0, 0);

      // A gentle upward trend with a weekday/weekend shape.
      const weekday = date.getUTCDay();
      const weekendFactor = weekday === 0 || weekday === 6 ? 0.45 : 1;
      const growth = 1 + (29 - i) * 0.035;
      const baseData = Math.round(38 * growth * weekendFactor);

      const started = Math.max(2, Math.round(baseData * 0.42));
      await prisma.dailyStat.create({
        data: {
          orgId: org.id,
          date,
          messagesIn: baseData,
          messagesOut: Math.round(baseData * 1.35),
          conversationsStarted: started,
          conversationsCompleted: Math.round(started * 0.68),
          aiCalls: Math.round(baseData * 0.3),
          avgLatencyMs: 240 + (i % 5) * 30,
        },
      });
    }
    console.log('  ✓ 30 days of analytics');
  }

  // -- usage for the current period -----------------------------------------
  const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  await prisma.usageRecord.upsert({
    where: { orgId_period: { orgId: org.id, period } },
    update: {},
    create: { orgId: org.id, period, messagesIn: 1420, messagesOut: 1910, aiCalls: 512, conversations: 388 },
  });

  console.log('✓ Seed complete');
  console.log(`  Sign in: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

// TODO: rest of this module is still being wired up
