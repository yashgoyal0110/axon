import { ChannelProvider, Plan } from '@prisma/client';

export interface PlanDefinition {
  id: Plan;
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  limits: {
    /** -1 means unlimited. */
    messagesPerMonth: number;
    aiCallsPerMonth: number;
    flows: number;
    channels: number;
    seats: number;
    apiKeys: number;
    analyticsRetentionDays: number;
  };
  providers: ChannelProvider[];
  highlights: string[];
  popular?: boolean;
}

export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    id: Plan.FREE,
    name: 'Sandbox',
    tagline: 'Build and test the whole product without a WhatsApp account.',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    limits: {
      messagesPerMonth: 250,
      aiCallsPerMonth: 10,
      flows: 3,
      channels: 1,
      seats: 2,
      apiKeys: 1,
      analyticsRetentionDays: 7,
    },
    providers: [ChannelProvider.SANDBOX],
    highlights: [
      'Full visual flow builder',
      'Built-in WhatsApp simulator - no Meta or Twilio account needed',
      'AI replies powered by Gemini',
      '250 simulated messages / month',
    ],
  },
  STARTER: {
    id: Plan.STARTER,
    name: 'Starter',
    tagline: 'Go live on a real WhatsApp number.',
    priceMonthlyUsd: 29,
    priceYearlyUsd: 290,
    limits: {
      messagesPerMonth: 10_000,
      aiCallsPerMonth: 3_000,
      flows: 10,
      channels: 2,
      seats: 5,
      apiKeys: 3,
      analyticsRetentionDays: 30,
    },
    providers: [ChannelProvider.SANDBOX, ChannelProvider.TWILIO, ChannelProvider.META_CLOUD],
    highlights: [
      'Everything in Sandbox',
      'Twilio and Meta Cloud API channels',
      'Shared team inbox',
      '10,000 messages / month',
      '30-day analytics retention',
    ],
  },
  PRO: {
    id: Plan.PRO,
    name: 'Pro',
    tagline: 'For teams running WhatsApp as a revenue channel.',
    priceMonthlyUsd: 99,
    priceYearlyUsd: 990,
    limits: {
      messagesPerMonth: 100_000,
      aiCallsPerMonth: 40_000,
      flows: 50,
      channels: 10,
      seats: 25,
      apiKeys: 10,
      analyticsRetentionDays: 180,
    },
    providers: [ChannelProvider.SANDBOX, ChannelProvider.TWILIO, ChannelProvider.META_CLOUD],
    highlights: [
      'Everything in Starter',
      'AI flow generation from a business description',
      'Funnel + drop-off analytics',
      'REST API and API keys',
      '100,000 messages / month',
    ],
    popular: true,
  },
  ENTERPRISE: {
    id: Plan.ENTERPRISE,
    name: 'Enterprise',
    tagline: 'Unlimited scale with audit trails and SSO-ready access control.',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    limits: {
      messagesPerMonth: -1,
      aiCallsPerMonth: -1,
      flows: -1,
      channels: -1,
      seats: -1,
      apiKeys: -1,
      analyticsRetentionDays: 365,
    },
    providers: [ChannelProvider.SANDBOX, ChannelProvider.TWILIO, ChannelProvider.META_CLOUD],
    highlights: [
      'Everything in Pro',
      'Unlimited messages, flows and seats',
      'Full audit log export',
      'Priority support and onboarding',
    ],
  },
};

export type QuotaKind = keyof PlanDefinition['limits'];

export function planFor(plan: Plan): PlanDefinition {
  return PLANS[plan] ?? PLANS.FREE;
}

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

/** Current billing period key, e.g. `2026-07`. */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
