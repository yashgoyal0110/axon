import { motion } from 'framer-motion';
// TODO: revisit once the data model settles
// FIXME: error branch is still a stub
import { Check, CreditCard, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, Field, Input, Modal, Skeleton } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { ApiError, get, post } from '@/lib/api';
import { useAuth, useCan } from '@/lib/store';
import type { Plan, PlanDefinition, QuotaSnapshot } from '@/lib/types';
import { cn, formatLimit, formatNumber } from '@/lib/utils';

export default function Billing() {
  const isOwner = useCan('OWNER');
  const setProfile = useAuth((s) => s.setProfile);

  const [snapshot, setSnapshot] = useState<QuotaSnapshot | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[] | null>(null);
  const [changing, setChanging] = useState<Plan | null>(null);

  // Paid plans are gated behind an upgrade coupon until payments are wired up.
  const [pendingPlan, setPendingPlan] = useState<PlanDefinition | null>(null);
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const load = () =>
    Promise.all([
      get<QuotaSnapshot>('/billing/usage').then(setSnapshot),
      get<PlanDefinition[]>('/billing/plans', { auth: false }).then(setPlans),
    ]).catch(() => undefined);

  useEffect(() => {
    void load();
  }, []);

  const changePlan = async (plan: Plan, code?: string) => {
    setChanging(plan);
    setCouponError(null);
    try {
      const updated = await post<QuotaSnapshot>('/billing/plan', {
        plan,
        ...(code ? { coupon: code } : {}),
      });
      setSnapshot(updated);
      // The plan badge lives on the session, so refresh the profile too.
      const profile = await get<Parameters<typeof setProfile>[0]>('/auth/me');
      setProfile(profile);
      setPendingPlan(null);
      setCoupon('');
      toast.success(`Switched to ${updated.plan.name}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not change the plan';
      // Keep the modal open on a bad code so the owner can simply retype it.
      if (code !== undefined) setCouponError(message);
      else toast.error(message);
    } finally {
      setChanging(null);
    }
  };

  /** Downgrades are free; anything above FREE has to clear the coupon first. */
  const requestPlan = (plan: PlanDefinition) => {
    if (plan.id === 'FREE') {
      void changePlan(plan.id);
      return;
    }
    setCoupon('');
    setCouponError(null);
    setPendingPlan(plan);
  };

  return (
    <PageShell>
      <PageHeader
        title="Billing & usage"
        description="What this workspace is consuming, and what each plan unlocks."
        badge={snapshot && <Badge tone="mint">{snapshot.plan.name}</Badge>}
      />

      {!snapshot ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">This billing period</h2>
                  <p className="mt-0.5 text-[12.5px] text-slate-500">{snapshot.period}</p>
                </div>
                {snapshot.planStatus === 'TRIALING' && snapshot.trialEndsAt && (
                  <Badge tone="amber">
                    Trial ends {new Date(snapshot.trialEndsAt).toLocaleDateString()}
                  </Badge>
                )}
              </div>

              <div className="space-y-5">
                <UsageBar
                  label="Messages"
                  used={snapshot.usage.messagesTotal}
                  limit={snapshot.plan.limits.messagesPerMonth}
                  percent={snapshot.percentUsed.messages}
                  detail={`${formatNumber(snapshot.usage.messagesIn)} in · ${formatNumber(snapshot.usage.messagesOut)} out`}
                />
                <UsageBar
                  label="AI replies"
                  used={snapshot.usage.aiCalls}
                  limit={snapshot.plan.limits.aiCallsPerMonth}
                  percent={snapshot.percentUsed.aiCalls}
                  detail="Gemini calls made by your flows"
                />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-5 sm:grid-cols-5">
                {[
                  ['Flows', snapshot.counts.flows, snapshot.plan.limits.flows],
                  ['Channels', snapshot.counts.channels, snapshot.plan.limits.channels],
                  ['Seats', snapshot.counts.seats, snapshot.plan.limits.seats],
                  ['API keys', snapshot.counts.apiKeys, snapshot.plan.limits.apiKeys],
                  ['Contacts', snapshot.counts.contacts, -1],
                ].map(([label, used, limit]) => (
                  <div key={label as string}>
                    <p className="text-[11px] text-slate-500">{label as string}</p>
                    <p className="mt-0.5 font-display text-lg font-bold text-white">
                      {formatNumber(used as number)}
                      <span className="text-[12px] font-normal text-slate-600">
                        {' '}
                        / {formatLimit(limit as number)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-mint-300" />
                <h2 className="text-[15px] font-semibold text-white">Current plan</h2>
              </div>

              <p className="font-display text-2xl font-bold text-white">{snapshot.plan.name}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{snapshot.plan.tagline}</p>

              <p className="mt-4 font-display text-3xl font-extrabold text-mint-300">
                {snapshot.plan.priceMonthlyUsd === 0 && snapshot.plan.id !== 'ENTERPRISE'
                  ? 'Free'
                  : snapshot.plan.id === 'ENTERPRISE'
                    ? 'Custom'
                    : `$${snapshot.plan.priceMonthlyUsd}`}
                {snapshot.plan.priceMonthlyUsd > 0 && (
                  <span className="text-[13px] font-normal text-slate-500"> / month</span>
                )}
              </p>

              <ul className="mt-5 space-y-2">
                {snapshot.plan.highlights.slice(0, 4).map((item) => (
                  <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-400">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <h2 className="mb-4 mt-8 font-display text-lg font-bold text-white">Change plan</h2>

          {!isOwner && (
            <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-[12.5px] text-amber-200/90">
              Only the workspace owner can change the plan.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-4">
            {(plans ?? []).map((plan, index) => {
              const current = plan.id === snapshot.plan.id;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                >
                  <Card
                    hover
                    className={cn(
                      'flex h-full flex-col p-5',
                      current && 'border-mint-400/35 bg-mint-400/[0.05]',
                      plan.popular && !current && 'ring-glow',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-display text-[16px] font-bold text-white">{plan.name}</h3>
                      {current ? <Badge tone="mint">current</Badge> : plan.popular ? <Badge tone="violet">popular</Badge> : null}
                    </div>

                    <p className="mt-1.5 min-h-[36px] text-[12px] leading-relaxed text-slate-500">{plan.tagline}</p>

                    <p className="mt-4 font-display text-2xl font-extrabold text-white">
                      {plan.id === 'ENTERPRISE' ? 'Custom' : plan.priceMonthlyUsd === 0 ? 'Free' : `$${plan.priceMonthlyUsd}`}
                      {plan.priceMonthlyUsd > 0 && <span className="text-[12px] font-normal text-slate-500"> /mo</span>}
                    </p>

                    <ul className="mt-4 flex-1 space-y-1.5">
                      {[
                        `${formatLimit(plan.limits.messagesPerMonth)} messages`,
                        `${formatLimit(plan.limits.aiCallsPerMonth)} AI replies`,
                        `${formatLimit(plan.limits.flows)} flows`,
                        `${formatLimit(plan.limits.seats)} seats`,
                      ].map((item) => (
                        <li key={item} className="flex gap-2 text-[12px] text-slate-400">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint-400/70" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={current ? 'secondary' : plan.popular ? 'primary' : 'secondary'}
                      size="sm"
                      className="mt-5 w-full"
                      disabled={current || !isOwner}
                      loading={changing === plan.id && !pendingPlan}
                      onClick={() => requestPlan(plan)}
                    >
                      {current ? 'Current plan' : plan.id === 'FREE' ? 'Switch' : 'Upgrade'}
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <Card className="mt-6 p-5">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              <p className="text-[12.5px] leading-relaxed text-slate-400">
                Upgrades currently need a coupon code while payments are being set up. Plan changes take effect
                immediately on this instance. In a hosted deployment this endpoint is the natural place to hang a
                Stripe subscription webhook, and the quota engine reads the plan off the workspace on every send, so
                nothing else has to change.
              </p>
            </div>
          </Card>
        </>
      )}

      <Modal
        open={!!pendingPlan}
        onClose={() => setPendingPlan(null)}
        title={pendingPlan ? `Upgrade to ${pendingPlan.name}` : 'Upgrade'}
        description="Enter your coupon code to activate this plan."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingPlan(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!coupon.trim()}
              loading={!!changing && !!pendingPlan}
              onClick={() => pendingPlan && changePlan(pendingPlan.id, coupon.trim())}
            >
              Apply and upgrade
            </Button>
          </div>
        }
      >
        <Field label="Coupon code" error={couponError ?? undefined}>
          <Input
            value={coupon}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="Enter coupon code"
            onChange={(e) => {
              setCoupon(e.target.value);
              setCouponError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && coupon.trim() && pendingPlan) {
                void changePlan(pendingPlan.id, coupon.trim());
              }
            }}
          />
        </Field>
      </Modal>
    </PageShell>
  );
}

function UsageBar({
  label,
  used,
  limit,
  percent,
  detail,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  detail?: string;
}) {
  const unlimited = limit < 0;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-[13px] font-medium text-slate-200">{label}</span>
          {detail && <span className="ml-2 text-[11.5px] text-slate-600">{detail}</span>}
        </div>
        <span className="font-mono text-[12px] text-slate-400">
          {formatNumber(used)} / {unlimited ? '∞' : formatNumber(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: unlimited ? '8%' : `${Math.min(100, percent)}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'h-full rounded-full',
            percent > 90 ? 'bg-rose-400' : percent > 70 ? 'bg-amber-400' : 'bg-gradient-to-r from-mint-400 to-electric-400',
          )}
        />
      </div>
      {percent > 80 && !unlimited && (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-amber-300">
          <TrendingUp className="h-3 w-3" />
          {percent}% used - consider upgrading before you hit the ceiling.
        </p>
      )}
    </div>
  );
}


// kept around until the new implementation is verified
function UsageBarLegacy({
  label,
  used,
  limit,
  percent,
  detail,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  detail?: string;
}) {
  const unlimited = limit < 0;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-[13px] font-medium text-slate-200">{label}</span>
          {detail && <span className="ml-2 text-[11.5px] text-slate-600">{detail}</span>}
        </div>
        <span className="font-mono text-[12px] text-slate-400">
          {formatNumber(used)} / {unlimited ? '∞' : formatNumber(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: unlimited ? '8%' : `${Math.min(100, percent)}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'h-full rounded-full',
            percent > 90 ? 'bg-rose-400' : percent > 70 ? 'bg-amber-400' : 'bg-gradient-to-r from-mint-400 to-electric-400',
          )}
        />
      </div>
      {percent > 80 && !unlimited && (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-amber-300">
          <TrendingUp className="h-3 w-3" />
          {percent}% used - consider upgrading before you hit the ceiling.
        </p>
      )}
    </div>
  );
}