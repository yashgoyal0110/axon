import { motion } from 'framer-motion';
import { ArrowRight, Check, HelpCircle, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Reveal, SectionHeading, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';
import type { PlanDefinition } from '@/lib/types';
import { cn, formatLimit } from '@/lib/utils';

export default function Pricing() {
  const [plans, setPlans] = useState<PlanDefinition[] | null>(null);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    get<PlanDefinition[]>('/billing/plans', { auth: false })
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  return (
    <div className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Pricing"
          title="Start on the sandbox. Pay when you go live."
          description="Every plan includes the full builder, the AI engine and the analytics. What changes is volume, channels and seats."
        />

        <Reveal delay={0.08}>
          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
              {[
                { label: 'Monthly', valueData: false },
                { label: 'Yearly', valueData: true },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => setYearly(option.valueData)}
                  className={cn(
                    'relative rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors',
                    yearly === option.valueData ? 'text-white' : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  {yearly === option.valueData && (
                    <motion.span
                      layoutId="billing-pill"
                      className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.07]"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{option.label}</span>
                  {option.valueData && (
                    <span className="relative ml-1.5 rounded bg-mint-400/15 px-1.5 py-0.5 text-[10px] font-bold text-mint-300">
                      −17%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {!plans
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[520px] rounded-2xl" />)
            : plans.map((plan, index) => (
                <Reveal key={plan.id} delay={index * 0.07}>
                  <PlanCard plan={plan} yearly={yearly} />
                </Reveal>
              ))}
        </div>

        <ComparisonTable plans={plans} />
        <Faq />
      </div>
    </div>
  );
}

function PlanCard({ plan, yearly }: { plan: PlanDefinition; yearly: boolean }) {
  const isEnterprise = plan.id === 'ENTERPRISE';
  const price = yearly ? Math.round(plan.priceYearlyUsd / 12) : plan.priceMonthlyUsd;

  return (
    <Card
      hover
      className={cn(
        'flex h-full flex-col p-6',
        plan.popular && 'ring-glow border-mint-400/30 bg-gradient-to-b from-mint-400/[0.06] to-transparent',
      )}
    >
      {plan.popular && (
        <Badge tone="mint" className="absolute right-5 top-5">
          Most popular
        </Badge>
      )}

      <h3 className="font-display text-lg font-bold text-white">{plan.name}</h3>
      <p className="mt-1.5 min-h-[40px] text-[13px] leading-relaxed text-slate-500">{plan.tagline}</p>

      <div className="mt-6 flex items-baseline gap-1.5">
        {isEnterprise ? (
          <span className="font-display text-3xl font-extrabold text-white">Custom</span>
        ) : (
          <>
            <span className="font-display text-4xl font-extrabold text-white">${price}</span>
            <span className="text-[13px] text-slate-500">/ month</span>
          </>
        )}
      </div>
      {yearly && !isEnterprise && plan.priceYearlyUsd > 0 && (
        <p className="mt-1 text-[11.5px] text-slate-600">${plan.priceYearlyUsd} billed annually</p>
      )}

      <Link to={isEnterprise ? '/docs' : '/register'} className="mt-6">
        <Button variant={plan.popular ? 'primary' : 'secondary'} className="w-full" iconRight={ArrowRight}>
          {isEnterprise ? 'Talk to us' : plan.priceMonthlyUsd === 0 ? 'Start free' : 'Get started'}
        </Button>
      </Link>

      <ul className="mt-7 space-y-2.5">
        {plan.highlights.map((item) => (
          <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-400">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-400" />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-1.5 border-t border-white/[0.07] pt-5 text-[12px] text-slate-500">
        {[
          ['Flows', formatLimit(plan.limits.flows)],
          ['Channels', formatLimit(plan.limits.channels)],
          ['Seats', formatLimit(plan.limits.seats)],
        ].map(([label, valueData]) => (
          <div key={label} className="flex justify-between">
            <span>{label}</span>
            <span className="font-medium text-slate-300">{valueData}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ComparisonTable({ plans }: { plans: PlanDefinition[] | null }) {
  if (!plans?.length) return null;

  const rows: Array<{ label: string; render: (plan: PlanDefinition) => string | boolean }> = [
    { label: 'Messages per month', render: (p) => formatLimit(p.limits.messagesPerMonth) },
    { label: 'AI replies per month', render: (p) => formatLimit(p.limits.aiCallsPerMonth) },
    { label: 'Flows', render: (p) => formatLimit(p.limits.flows) },
    { label: 'Channels', render: (p) => formatLimit(p.limits.channels) },
    { label: 'Team seats', render: (p) => formatLimit(p.limits.seats) },
    { label: 'API keys', render: (p) => formatLimit(p.limits.apiKeys) },
    { label: 'Analytics retention', render: (p) => `${p.limits.analyticsRetentionDays} days` },
    { label: 'Sandbox simulator', render: () => true },
    { label: 'Twilio channel', render: (p) => p.providers.includes('TWILIO') },
    { label: 'Meta Cloud API channel', render: (p) => p.providers.includes('META_CLOUD') },
    { label: 'AI flow generation', render: (p) => p.id === 'PRO' || p.id === 'ENTERPRISE' },
    { label: 'Audit log export', render: (p) => p.id === 'ENTERPRISE' },
  ];

  return (
    <Reveal delay={0.12}>
      <div className="mt-20">
        <h3 className="mb-6 text-center font-display text-xl font-bold text-white">Compare every plan</h3>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="px-5 py-4 text-[12px] font-semibold uppercase tracking-wider text-slate-500">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="px-5 py-4 text-center text-[13px] font-semibold text-white">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((row) => (
                <tr key={row.label} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-[13px] text-slate-400">{row.label}</td>
                  {plans.map((plan) => {
                    const valueData = row.render(plan);
                    return (
                      <td key={plan.id} className="px-5 py-3 text-center text-[13px]">
                        {typeof valueData === 'boolean' ? (
                          valueData ? (
                            <Check className="mx-auto h-4 w-4 text-mint-400" />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-slate-700" />
                          )
                        ) : (
                          <span className="font-medium text-slate-200">{valueData}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </Reveal>
  );
}

function Faq() {
  const faqs = [
    {
      q: 'Do I need a WhatsApp Business account to try this?',
      a: 'No. The free plan ships with a sandbox channel that runs the real conversation engine inside the app. Everything - routing, AI, analytics, the inbox - behaves exactly as it will in production, without a provider.',
    },
    {
      q: 'What happens when I hit my message quota?',
      a: 'Outbound sends are blocked and recorded as failed with the reason attached, so nothing disappears silently. Inbound messages are still stored. Upgrading lifts the cap immediately.',
    },
    {
      q: 'Where do the AI replies come from?',
      a: 'Google Gemini, called with the conversation history and the persona you configure on the flow. If no API key is set on the server, flows fall back to the message you define rather than erroring.',
    },
    {
      q: 'Can I self-host?',
      a: 'Yes. The whole platform builds into a single Docker image with Postgres and optional Redis alongside. One compose file, one port.',
    },
    {
      q: 'How isolated are workspaces?',
      a: 'Every table is keyed by workspace and every query is scoped by the authenticated principal. A user can belong to several workspaces and switch between them, but data never crosses the boundary.',
    },
  ];

  return (
    <div className="mx-auto mt-20 max-w-3xl">
      <h3 className="mb-8 text-center font-display text-xl font-bold text-white">Questions people actually ask</h3>
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <Reveal key={faq.q} delay={index * 0.05}>
            <Card className="p-5">
              <div className="flex gap-3">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-mint-400" />
                <div>
                  <p className="text-[14.5px] font-semibold text-white">{faq.q}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-400">{faq.a}</p>
                </div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
