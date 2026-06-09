import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Inbox,
  MessageSquare,
  Plug,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Card, EmptyState, LiveDot, Skeleton } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/store';
import type { Channel, Conversation, Flow, Overview, Paginated, QuotaSnapshot } from '@/lib/types';
import { cn, formatNumber, formatRelative } from '@/lib/utils';

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [recent, setRecent] = useState<Conversation[] | null>(null);

  useEffect(() => {
    void Promise.all([
      get<Overview>('/analytics/overview?days=30').then(setOverview),
      get<QuotaSnapshot>('/billing/usage').then(setQuota),
      get<Flow[]>('/flows').then(setFlows),
      get<Channel[]>('/channels').then(setChannels),
      get<Paginated<Conversation>>('/conversations?pageSize=6').then((r) => setRecent(r.items)),
    ]).catch(() => undefined);
  }, []);

  const publishedFlows = flows?.filter((f) => f.status === 'PUBLISHED').length ?? 0;
  const liveChannels = channels?.filter((c) => c.status === 'ACTIVE' && c.provider !== 'SANDBOX').length ?? 0;

  return (
    <PageShell>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description="Here's what your bots have been up to over the last 30 days."
        badge={
          overview?.totals.activeNow ? (
            <Badge tone="mint">
              <LiveDot className="mr-0.5" />
              {overview.totals.activeNow} live now
            </Badge>
          ) : undefined
        }
        actions={
          <>
            <Link to="/app/simulator">
              <Button variant="secondary" icon={Sparkles}>
                Simulator
              </Button>
            </Link>
            <Link to="/app/flows">
              <Button icon={Workflow}>New flow</Button>
            </Link>
          </>
        }
      />

      {!overview ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={MessageSquare}
            label="Messages"
            value={overview.totals.messagesIn + overview.totals.messagesOut}
            delta={overview.deltas.messages}
            tone="mint"
          />
          <StatTile
            icon={Inbox}
            label="Conversations"
            value={overview.totals.conversations}
            delta={overview.deltas.conversations}
            tone="electric"
          />
          <StatTile
            icon={CheckCircle2}
            label="Completion rate"
            value={overview.rates.completionRate}
            suffix="%"
            delta={overview.deltas.completionRate}
            deltaSuffix="pt"
            tone="violet"
          />
          <StatTile icon={Bot} label="AI replies" value={overview.totals.aiReplies} tone="amber" />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-white">Message volume</h2>
              <p className="mt-0.5 text-[12.5px] text-slate-500">Inbound and outbound, last 30 days</p>
            </div>
            <Link to="/app/analytics">
              <Button variant="ghost" size="sm" iconRight={ArrowUpRight}>
                Details
              </Button>
            </Link>
          </div>

          {!overview ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart data={overview.series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4dfbb1" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#4dfbb1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />
                <Area
                  type="monotone"
                  dataKey="messagesIn"
                  name="Inbound"
                  stroke="#4dfbb1"
                  strokeWidth={2}
                  fill="url(#gIn)"
                />
                <Area
                  type="monotone"
                  dataKey="messagesOut"
                  name="Outbound"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fill="url(#gOut)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="space-y-4">
          <SetupCard publishedFlows={publishedFlows} liveChannels={liveChannels} contacts={quota?.counts.contacts ?? 0} />
          {quota && <UsageCard quota={quota} />}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-white">Recent conversations</h2>
            <Link to="/app/inbox" className="text-[12.5px] font-medium text-mint-300 hover:text-mint-200">
              Open inbox
            </Link>
          </div>

          {!recent ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No conversations yet"
              description="Open the simulator and send your bot a message to see it here."
              action={
                <Link to="/app/simulator">
                  <Button size="sm" icon={Sparkles}>
                    Try the simulator
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-1">
              {recent.map((conversation, index) => (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Link
                    to={`/app/inbox?c=${conversation.id}`}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-emerald-700 text-[11px] font-bold text-ink-950">
                      {(conversation.contact.name ?? conversation.contact.waId).slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-200">
                        {conversation.contact.name ?? conversation.contact.waId}
                      </span>
                      <span className="block truncate text-[12px] text-slate-500">
                        {conversation.lastMessage?.body ?? 'No messages yet'}
                      </span>
                    </span>
                    <StatusPill status={conversation.status} />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-white">Your flows</h2>
            <Link to="/app/flows" className="text-[12.5px] font-medium text-mint-300 hover:text-mint-200">
              Manage
            </Link>
          </div>

          {!flows ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : flows.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No flows yet"
              description="Start from a template or let AI draft one from your business description."
              action={
                <Link to="/app/flows">
                  <Button size="sm">Create a flow</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-1">
              {flows.slice(0, 5).map((flow, index) => (
                <motion.div
                  key={flow.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Link
                    to={`/app/flows/${flow.id}`}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <Workflow className="h-4 w-4 shrink-0 text-slate-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-200">{flow.name}</span>
                      <span className="block text-[12px] text-slate-500">
                        {flow.nodeCount ?? 0} steps · {formatNumber(flow._count?.conversations ?? 0)} conversations
                      </span>
                    </span>
                    <Badge tone={flow.status === 'PUBLISHED' ? 'mint' : 'slate'}>{flow.status.toLowerCase()}</Badge>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------

const TONE_STYLES: Record<string, string> = {
  mint: 'text-mint-300 bg-mint-400/[0.09] border-mint-400/20',
  electric: 'text-electric-300 bg-electric-400/[0.09] border-electric-400/20',
  violet: 'text-violet-300 bg-violet-400/[0.09] border-violet-400/20',
  amber: 'text-amber-300 bg-amber-400/[0.09] border-amber-400/20',
};

function StatTile({
  icon: Icon,
  label,
  value,
  suffix = '',
  delta,
  deltaSuffix = '%',
  tone,
}: {
  icon: typeof Zap;
  label: string;
  value: number;
  suffix?: string;
  delta?: number;
  deltaSuffix?: string;
  tone: keyof typeof TONE_STYLES;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', TONE_STYLES[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        {delta !== undefined && delta !== 0 && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              positive ? 'bg-mint-400/10 text-mint-300' : 'bg-rose-400/10 text-rose-300',
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {positive ? '+' : ''}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-2xl font-bold text-white">
        {formatNumber(value)}
        {suffix}
      </p>
      <p className="mt-0.5 text-[12.5px] text-slate-500">{label}</p>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2 shadow-lift backdrop-blur-xl">
      <p className="mb-1 text-[11px] font-medium text-slate-400">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-[12px] text-slate-200">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-semibold">{formatNumber(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: Conversation['status'] }) {
  const map: Record<Conversation['status'], { tone: 'mint' | 'slate' | 'amber' | 'rose'; label: string }> = {
    ACTIVE: { tone: 'mint', label: 'active' },
    COMPLETED: { tone: 'slate', label: 'done' },
    HANDOFF: { tone: 'amber', label: 'handoff' },
    ABANDONED: { tone: 'rose', label: 'dropped' },
  };
  const config = map[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

function SetupCard({
  publishedFlows,
  liveChannels,
  contacts,
}: {
  publishedFlows: number;
  liveChannels: number;
  contacts: number;
}) {
  const steps = [
    { label: 'Publish a flow', done: publishedFlows > 0, to: '/app/flows', icon: Workflow },
    { label: 'Test in the simulator', done: contacts > 0, to: '/app/simulator', icon: Sparkles },
    { label: 'Connect a real number', done: liveChannels > 0, to: '/app/channels', icon: Plug },
    { label: 'Invite your team', done: false, to: '/app/settings', icon: Users },
  ];
  const completed = steps.filter((s) => s.done).length;

  if (completed === steps.length) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-white">Get set up</h3>
        <span className="text-[11.5px] text-slate-500">
          {completed}/{steps.length}
        </span>
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(completed / steps.length) * 100}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-mint-400 to-electric-400"
        />
      </div>

      <div className="space-y-1">
        {steps.map((step) => (
          <Link
            key={step.label}
            to={step.to}
            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                step.done ? 'border-mint-400/40 bg-mint-400/15' : 'border-white/12',
              )}
            >
              {step.done && <CheckCircle2 className="h-3 w-3 text-mint-400" />}
            </span>
            <span className={cn('flex-1 text-[12.5px]', step.done ? 'text-slate-600 line-through' : 'text-slate-300')}>
              {step.label}
            </span>
            {!step.done && (
              <ArrowRight className="h-3 w-3 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function UsageCard({ quota }: { quota: QuotaSnapshot }) {
  const bars = [
    {
      label: 'Messages',
      used: quota.usage.messagesTotal,
      limit: quota.plan.limits.messagesPerMonth,
      percent: quota.percentUsed.messages,
    },
    {
      label: 'AI replies',
      used: quota.usage.aiCalls,
      limit: quota.plan.limits.aiCallsPerMonth,
      percent: quota.percentUsed.aiCalls,
    },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-white">This month</h3>
        <Badge tone="mint">{quota.plan.name}</Badge>
      </div>

      <div className="space-y-4">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[12.5px] text-slate-400">{bar.label}</span>
              <span className="font-mono text-[11.5px] text-slate-500">
                {formatNumber(bar.used)} / {bar.limit < 0 ? '∞' : formatNumber(bar.limit)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, bar.percent)}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'h-full rounded-full',
                  bar.percent > 90
                    ? 'bg-rose-400'
                    : bar.percent > 70
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-mint-400 to-electric-400',
                )}
              />
            </div>
          </div>
        ))}
      </div>

      <Link to="/app/billing" className="mt-4 block">
        <Button variant="secondary" size="sm" className="w-full" iconRight={ArrowUpRight}>
          Manage plan
        </Button>
      </Link>
    </Card>
  );
}


// kept around until the new implementation is verified
function StatTileV1({
  icon: Icon,
  label,
  value,
  suffix = '',
  delta,
  deltaSuffix = '%',
  tone,
}: {
  icon: typeof Zap;
  label: string;
  value: number;
  suffix?: string;
  delta?: number;
  deltaSuffix?: string;
  tone: keyof typeof TONE_STYLES;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', TONE_STYLES[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        {delta !== undefined && delta !== 0 && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              positive ? 'bg-mint-400/10 text-mint-300' : 'bg-rose-400/10 text-rose-300',
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {positive ? '+' : ''}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-2xl font-bold text-white">
        {formatNumber(value)}
        {suffix}
      </p>
      <p className="mt-0.5 text-[12.5px] text-slate-500">{label}</p>
    </Card>
  );
}