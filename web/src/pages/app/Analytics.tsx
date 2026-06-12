import { motion } from 'framer-motion';
import { Activity, BarChart3, Bot, Clock, GitBranch, Inbox, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Card, EmptyState, Select, Skeleton } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { get } from '@/lib/api';
import type { Channel, Flow, FlowPerformance, FunnelNode, Overview } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

const RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const PIE_COLORS = ['#4dfbb1', '#38bdf8', '#a78bfa', '#f59e0b', '#f472b6'];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [flowStats, setFlowStats] = useState<FlowPerformance[] | null>(null);
  const [channelStats, setChannelStats] = useState<Array<Channel & { messages: number; conversations: number; failed: number }> | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [funnelFlowId, setFunnelFlowId] = useState<string>('');
  const [funnel, setFunnel] = useState<{ nodes: FunnelNode[]; totalConversations: number } | null>(null);

  useEffect(() => {
    setOverview(null);
    void Promise.all([
      get<Overview>(`/analytics/overview?days=${days}`).then(setOverview),
      get<FlowPerformance[]>(`/analytics/flows?days=${days}`).then(setFlowStats),
      get<typeof channelStats>(`/analytics/channels?days=${days}`).then(setChannelStats),
    ]).catch(() => undefined);
  }, [days]);

  useEffect(() => {
    void get<Flow[]>('/flows').then((list) => {
      setFlows(list);
      if (list.length && !funnelFlowId) setFunnelFlowId(list.find((f) => f.isDefault)?.id ?? list[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!funnelFlowId) return;
    setFunnel(null);
    void get<typeof funnel>(`/analytics/funnel/${funnelFlowId}?days=${days}`).then(setFunnel).catch(() => setFunnel(null));
  }, [funnelFlowId, days]);

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        description="How your bots are performing, computed for this workspace only."
        actions={
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
            {RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </Select>
        }
      />

      {!overview ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              icon={Inbox}
              label="Conversations"
              value={formatNumber(overview.totals.conversations)}
              delta={overview.deltas.conversations}
            />
            <Metric
              icon={Activity}
              label="Completion rate"
              value={`${overview.rates.completionRate}%`}
              delta={overview.deltas.completionRate}
              deltaSuffix="pt"
            />
            <Metric icon={Bot} label="AI deflection" value={`${overview.rates.aiDeflectionRate}%`} />
            <Metric icon={Clock} label="Avg response" value={`${overview.rates.avgResponseMs}ms`} />
            <Metric icon={Users} label="Contacts" value={formatNumber(overview.totals.contacts)} />
            <Metric icon={GitBranch} label="Handoff rate" value={`${overview.rates.handoffRate}%`} />
            <Metric
              icon={BarChart3}
              label="Messages"
              value={formatNumber(overview.totals.messagesIn + overview.totals.messagesOut)}
              delta={overview.deltas.messages}
            />
            <Metric
              icon={Activity}
              label="Msgs / conversation"
              value={String(overview.rates.avgMessagesPerConversation)}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card className="p-6">
              <h2 className="mb-1 text-[15px] font-semibold text-white">Traffic over time</h2>
              <p className="mb-5 text-[12.5px] text-slate-500">Inbound vs outbound messages</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={overview.series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4dfbb1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#4dfbb1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#475569', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d: string) => d.slice(5)}
                    minTickGap={28}
                  />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="messagesIn" name="Inbound" stroke="#4dfbb1" strokeWidth={2} fill="url(#aIn)" />
                  <Area type="monotone" dataKey="messagesOut" name="Outbound" stroke="#a78bfa" strokeWidth={2} fill="url(#aOut)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h2 className="mb-1 text-[15px] font-semibold text-white">Conversation outcomes</h2>
              <p className="mb-5 text-[12.5px] text-slate-500">Started vs completed, per day</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={overview.series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#475569', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d: string) => d.slice(5)}
                    minTickGap={30}
                  />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="conversationsStarted"
                    name="Started"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="conversationsCompleted"
                    name="Completed"
                    stroke="#4dfbb1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* Funnel */}
      <Card className="mt-4 p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Where people drop off</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              How many conversations reached each step, and how many are still sitting there.
            </p>
          </div>
          <Select value={funnelFlowId} onChange={(e) => setFunnelFlowId(e.target.value)} className="sm:w-56">
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name}
              </option>
            ))}
          </Select>
        </div>

        {!funnel ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : funnel.nodes.length === 0 ? (
          <EmptyState icon={GitBranch} title="No traffic yet" description="Once conversations run through this flow, its funnel appears here." />
        ) : (
          <div className="space-y-2.5">
            {funnel.nodes.map((node, index) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-[12.5px] text-slate-300" title={node.label}>
                    {node.label}
                  </span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-white/[0.04]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, node.reachRate)}%` }}
                      transition={{ duration: 0.8, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-lg bg-gradient-to-r from-mint-500/70 to-electric-400/60"
                    />
                    <span className="absolute inset-y-0 left-3 flex items-center font-mono text-[11px] font-semibold text-white/90">
                      {formatNumber(node.reached)}
                    </span>
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[11.5px] text-slate-500">
                    {node.reachRate}%
                  </span>
                  {node.waiting > 0 && (
                    <Badge tone="amber" className="shrink-0">
                      {node.waiting} waiting
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 text-[15px] font-semibold text-white">Flow performance</h2>
          {!flowStats ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : flowStats.length === 0 ? (
            <EmptyState icon={BarChart3} title="No flows yet" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, flowStats.length * 46)}>
              <BarChart data={flowStats} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="started" name="Started" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={11} />
                <Bar dataKey="completed" name="Completed" fill="#4dfbb1" radius={[0, 4, 4, 0]} barSize={11} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-5 text-[15px] font-semibold text-white">Volume by channel</h2>
          {!channelStats ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : channelStats.every((c) => c.messages === 0) ? (
            <EmptyState icon={Activity} title="No traffic yet" description="Send a message in the simulator to populate this." />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={channelStats.filter((c) => c.messages > 0)}
                    dataKey="messages"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {channelStats.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="w-full space-y-2 sm:w-48">
                {channelStats.map((channel, index) => (
                  <div key={channel.id} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-300">{channel.name}</span>
                    <span className="font-mono text-slate-500">{formatNumber(channel.messages)}</span>
                    {channel.failed > 0 && (
                      <span className="font-mono text-rose-400" title="Failed sends">
                        {channel.failed}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  delta,
  deltaSuffix = '%',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  delta?: number;
  deltaSuffix?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card hover className="p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-slate-600" />
        {delta !== undefined && delta !== 0 && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[10.5px] font-semibold',
              positive ? 'text-mint-300' : 'text-rose-300',
            )}
          >
            {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {positive ? '+' : ''}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      <p className="mt-2.5 font-display text-xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[11.5px] text-slate-500">{label}</p>
    </Card>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2 shadow-lift backdrop-blur-xl">
      {label && <p className="mb-1 text-[11px] font-medium text-slate-400">{label}</p>}
      {payload.map((entry, index) => (
        <p key={index} className="flex items-center gap-2 text-[12px] text-slate-200">
          {entry.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />}
          {entry.name}: <span className="font-semibold">{formatNumber(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}
