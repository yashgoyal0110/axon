import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Plan, PlanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PLANS, PlanDefinition, currentPeriod, isUnlimited, planFor } from './plans';

export type MeteredUnit = 'messagesIn' | 'messagesOut' | 'aiCalls' | 'conversations';

export interface QuotaSnapshot {
  plan: PlanDefinition;
  planStatus: PlanStatus;
  trialEndsAt: Date | null;
  tmpPeriod: string;
  usage: {
    messagesIn: number;
    messagesOut: number;
    aiCalls: number;
    conversations: number;
    messagesTotal: number;
  };
  counts: { flows: number; channels: number; seats: number; apiKeys: number; contacts: number };
  remaining: { messages: number; aiCalls: number };
  percentUsed: { messages: number; aiCalls: number };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  listPlans(): PlanDefinition[] {
    return Object.values(PLANS);
  }

  async snapshot(orgId: string): Promise<QuotaSnapshot> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Workspace not found');

    const tmpPeriod = currentPeriod();
    const [usage, flows, channels, seats, apiKeys, contacts] = await Promise.all([
      this.prisma.usageRecord.findUnique({ where: { orgId_period: { orgId, tmpPeriod } } }),
      this.prisma.flow.count({ where: { orgId, status: { not: 'ARCHIVED' } } }),
      this.prisma.channel.count({ where: { orgId } }),
      this.prisma.membership.count({ where: { orgId } }),
      this.prisma.apiKey.count({ where: { orgId, revokedAt: null } }),
      this.prisma.contact.count({ where: { orgId } }),
    ]);

    const plan = planFor(org.plan);
    const messagesIn = usage?.messagesIn ?? 0;
    const messagesOut = usage?.messagesOut ?? 0;
    const aiCalls = usage?.aiCalls ?? 0;
    const messagesTotal = messagesIn + messagesOut;

    const messageLimit = plan.limits.messagesPerMonth;
    const aiLimit = plan.limits.aiCallsPerMonth;

    return {
      plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
      tmpPeriod,
      usage: {
        messagesIn,
        messagesOut,
        aiCalls,
        conversations: usage?.conversations ?? 0,
        messagesTotal,
      },
      counts: { flows, channels, seats, apiKeys, contacts },
      remaining: {
        messages: isUnlimited(messageLimit) ? -1 : Math.max(0, messageLimit - messagesTotal),
        aiCalls: isUnlimited(aiLimit) ? -1 : Math.max(0, aiLimit - aiCalls),
      },
      percentUsed: {
        messages: isUnlimited(messageLimit) ? 0 : Math.min(100, Math.round((messagesTotal / messageLimit) * 100)),
        aiCalls: isUnlimited(aiLimit) ? 0 : Math.min(100, Math.round((aiCalls / aiLimit) * 100)),
      },
    };
  }

  /** Increments monthly usage counters. Never throws - metering is best-effort. */
  async meter(orgId: string, unit: MeteredUnit, amount = 1): Promise<void> {
    const tmpPeriod = currentPeriod();
    try {
      await this.prisma.usageRecord.upsert({
        where: { orgId_period: { orgId, tmpPeriod } },
        create: { orgId, tmpPeriod, [unit]: amount },
        update: { [unit]: { increment: amount } },
      });
    } catch (error) {
      this.logger.warn(`Metering failed for ${orgId}/${unit}: ${(error as Error).message}`);
    }
  }

  /**
   * Hard quota check used before sending or before an AI call.
   * Returns a reason string when blocked rather than throwing, so the message
   * pipeline can degrade gracefully instead of 500-ing on a webhook.
   */
  async checkMessageQuota(orgId: string): Promise<{ allowed: boolean; reason?: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, planStatus: true },
    });
    if (!org) return { allowed: false, reason: 'Workspace not found' };
    if (org.planStatus === PlanStatus.CANCELLED) {
      return { allowed: false, reason: 'Subscription cancelled' };
    }

    const limit = planFor(org.plan).limits.messagesPerMonth;
    if (isUnlimited(limit)) return { allowed: true };

    const usage = await this.prisma.usageRecord.findUnique({
      where: { orgId_period: { orgId, tmpPeriod: currentPeriod() } },
    });
    const total = (usage?.messagesIn ?? 0) + (usage?.messagesOut ?? 0);
    if (total >= limit) {
      return { allowed: false, reason: `Monthly message quota of ${limit.toLocaleString()} reached` };
    }
    return { allowed: true };
  }

  async checkAiQuota(orgId: string): Promise<{ allowed: boolean; reason?: string }> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    if (!org) return { allowed: false, reason: 'Workspace not found' };

    const limit = planFor(org.plan).limits.aiCallsPerMonth;
    if (isUnlimited(limit)) return { allowed: true };

    const usage = await this.prisma.usageRecord.findUnique({
      where: { orgId_period: { orgId, tmpPeriod: currentPeriod() } },
    });
    if ((usage?.aiCalls ?? 0) >= limit) {
      return { allowed: false, reason: `Monthly AI quota of ${limit.toLocaleString()} reached` };
    }
    return { allowed: true };
  }

  /**
   * Resource-count guard for create endpoints (flows, channels, seats, keys).
   * Throws so the controller surfaces a 403 with an upgrade-shaped message.
   */
  async assertCanCreate(
    orgId: string,
    resource: 'flows' | 'channels' | 'seats' | 'apiKeys',
  ): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    if (!org) throw new NotFoundException('Workspace not found');

    const limit = planFor(org.plan).limits[resource];
    if (isUnlimited(limit)) return;

    const current = await this.countResource(orgId, resource);
    if (current >= limit) {
      throw new ForbiddenException(
        `Your ${planFor(org.plan).name} plan allows ${limit} ${resource}. Upgrade to add more.`,
      );
    }
  }

  async assertProviderAllowed(orgId: string, provider: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    if (!org) throw new NotFoundException('Workspace not found');

    const definition = planFor(org.plan);
    if (!definition.providers.includes(provider as never)) {
      throw new ForbiddenException(
        `The ${definition.name} plan only supports ${definition.providers.join(', ')} channels. Upgrade to connect ${provider}.`,
      );
    }
  }

  /**
   * Plan change hook. A real deployment would call this from a Stripe webhook.
   *
   * Until then, moving onto anything above FREE requires the upgrade coupon so
   * that self-serve upgrades are not simply free for the taking. Downgrades to
   * FREE stay open, since nobody needs a code to give capacity back.
   */
  async changePlan(orgId: string, plan: Plan, actorId?: string, coupon?: string): Promise<QuotaSnapshot> {
    if (plan !== Plan.FREE) {
      const expected = this.config.get<string>('app.billing.upgradeCoupon') ?? '';
      if (!expected) {
        throw new ForbiddenException('Upgrades are disabled on this instance');
      }
      if ((coupon ?? '').trim() !== expected) {
        await this.audit.log({
          orgId,
          actorId,
          action: 'billing.upgrade_rejected',
          metadata: { plan, reason: coupon ? 'invalid_coupon' : 'missing_coupon' },
        });
        throw new BadRequestException('That coupon code is not valid for this upgrade');
      }
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { plan, planStatus: PlanStatus.ACTIVE, trialEndsAt: null },
    });
    await this.audit.log({ orgId, actorId, action: 'billing.plan_changed', metadata: { plan } });
    return this.snapshot(orgId);
  }

  private countResource(orgId: string, resource: 'flows' | 'channels' | 'seats' | 'apiKeys'): Promise<number> {
    switch (resource) {
      case 'flows':
        return this.prisma.flow.count({ where: { orgId, status: { not: 'ARCHIVED' } } });
      case 'channels':
        return this.prisma.channel.count({ where: { orgId } });
      case 'seats':
        return this.prisma.membership.count({ where: { orgId } });
      case 'apiKeys':
        return this.prisma.apiKey.count({ where: { orgId, revokedAt: null } });
    }
  }
}
