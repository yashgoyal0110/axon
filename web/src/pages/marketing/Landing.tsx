import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Fingerprint,
  GitBranch,
  Inbox,
  KeyRound,
  Layers,
  MessageSquare,
  Plug,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CountUp, LiveDot, Reveal, SectionHeading, TiltCard } from '@/components/ui';
import { PhoneMockup } from '@/components/marketing/PhoneMockup';
import { FlowCanvasPreview } from '@/components/marketing/FlowCanvasPreview';
import { cn } from '@/lib/utils';

export default function Landing() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <BuilderSection />
      <FeatureGrid />
      <ChannelSection />
      <AnalyticsSection />
      <PlatformSection />
      <FinalCta />
    </>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ring-glow inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-sm">
              <LiveDot />
              <span className="text-[12.5px] font-medium text-slate-300">
                Works without a WhatsApp account - try the sandbox
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 text-balance font-display text-[2.6rem] font-extrabold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.1rem]"
          >
            WhatsApp bots you{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-mint-300 via-electric-300 to-violet-300 bg-clip-text text-transparent">
                draw
              </span>
              <motion.svg
                viewBox="0 0 200 12"
                className="absolute -bottom-1.5 left-0 w-full"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, delay: 0.7 }}
              >
                <motion.path
                  d="M2 8 Q 50 2, 100 7 T 198 5"
                  fill="none"
                  stroke="url(#underline)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="underline" x1="0" x2="1">
                    <stop offset="0%" stopColor="#4dfbb1" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </motion.svg>
            </span>
            , not code.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-slate-400"
          >
            Sketch the conversation on a canvas. Axon runs it on WhatsApp, hands anything unscripted to Gemini, and
            shows you exactly where people drop off - across every workspace you manage.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link to="/register">
              <Button size="lg" iconRight={ArrowRight}>
                Start building free
              </Button>
            </Link>
            <Link to="/product">
              <Button size="lg" variant="secondary" icon={Play}>
                See how it works
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.36 }}
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-slate-500"
          >
            {['No credit card', 'Meta Cloud API + Twilio', 'Self-hostable in one container'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-mint-400" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function TrustStrip() {
  const stats = [
    { label: 'Messages routed', value: 2_400_000, suffix: '+', icon: MessageSquare },
    { label: 'Median bot reply', value: 420, suffix: 'ms', icon: Zap },
    { label: 'Resolved without a human', value: 73, suffix: '%', icon: Bot },
    { label: 'Uptime across regions', value: 99.98, suffix: '%', icon: Activity, decimals: 2 },
  ];

  return (
    <section className="border-y border-white/[0.06] bg-ink-950/40 px-5 py-10 backdrop-blur-sm sm:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Reveal key={stat.label} delay={index * 0.08}>
            <div className="text-center lg:text-left">
              <stat.icon className="mx-auto mb-2 h-4 w-4 text-mint-400/70 lg:mx-0" />
              <p className="font-display text-2xl font-bold text-white sm:text-3xl">
                <CountUp
                  value={stat.value}
                  format={(n) =>
                    stat.decimals
                      ? (n / 100).toFixed(2)
                      : n >= 1_000_000
                        ? `${(n / 1_000_000).toFixed(1)}M`
                        : n.toLocaleString()
                  }
                />
                <span className="text-mint-400">{stat.suffix}</span>
              </p>
              <p className="mt-1 text-[12.5px] text-slate-500">{stat.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function BuilderSection() {
  const steps = [
    {
      icon: Workflow,
      title: 'Drag the conversation',
      body: 'Questions, free-text capture, branching rules, AI steps and handoffs - wired together on an infinite canvas.',
    },
    {
      icon: Sparkles,
      title: 'Or describe it once',
      body: 'Tell Axon what your business does and Gemini drafts the whole flow, laid out and ready to edit.',
    },
    {
      icon: Play,
      title: 'Test before you ship',
      body: 'The built-in simulator runs the real engine - same routing, same AI - with zero WhatsApp credentials.',
    },
  ];

  return (
    <section className="px-5 py-24 sm:px-8" id="builder">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="The builder"
          title={
            <>
              A canvas that behaves like{' '}
              <span className="text-gradient-mint">the real thing</span>
            </>
          }
          description="Every node you place is a step a customer actually walks through. Publish creates an immutable version, so an edit can never break a conversation already in flight."
        />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <Reveal>
            <FlowCanvasPreview />
          </Reveal>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={0.1 + index * 0.09}>
                <Card hover className="group p-5">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-mint-400/20 bg-mint-400/[0.08] transition-transform duration-300 group-hover:scale-110">
                      <step.icon className="h-4.5 w-4.5 text-mint-300" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">{step.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-400">{step.body}</p>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function FeatureGrid() {
  const features = [
    {
      icon: Bot,
      title: 'AI that stays on-script',
      body: 'Gemini answers anything your flow did not anticipate, inside a persona you define - then hands control straight back to the flow.',
      tone: 'violet' as const,
    },
    {
      icon: Inbox,
      title: 'Shared team inbox',
      body: 'Watch live conversations, jump in as a human, and hand back to the bot when you are done.',
      tone: 'electric' as const,
    },
    {
      icon: BarChart3,
      title: 'Per-node drop-off',
      body: 'See exactly which question loses people, how many replies AI absorbed, and what completion looks like day over day.',
      tone: 'mint' as const,
    },
    {
      icon: Building2,
      title: 'Real multi-tenancy',
      body: 'Workspaces are isolated end to end. Invite teammates with owner, admin, agent or viewer roles and switch between accounts in a click.',
      tone: 'amber' as const,
    },
    {
      icon: ShieldCheck,
      title: 'Signed webhooks',
      body: 'X-Hub-Signature-256 for Meta, HMAC-SHA1 validation for Twilio, credentials encrypted at rest with AES-256-GCM.',
      tone: 'mint' as const,
    },
    {
      icon: KeyRound,
      title: 'API keys and audit trail',
      body: 'Drive everything programmatically, and keep a record of who changed what, when, and from where.',
      tone: 'violet' as const,
    },
  ];

  const TONE: Record<string, string> = {
    mint: 'from-mint-400/20 to-transparent text-mint-300 border-mint-400/20',
    violet: 'from-violet-400/20 to-transparent text-violet-300 border-violet-400/20',
    electric: 'from-electric-400/20 to-transparent text-electric-300 border-electric-400/20',
    amber: 'from-amber-400/20 to-transparent text-amber-300 border-amber-400/20',
  };

  return (
    <section className="relative px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Platform"
          title="Everything the demo never has"
          description="The parts that turn a prototype into something you can sell: tenancy, quotas, rate limits, audit logs and an inbox real people can work in."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.06}>
              <TiltCard className="h-full">
                <Card hover className="group h-full p-6">
                  <div
                    className={cn(
                      'mb-4 flex h-11 w-11 items-center justify-center rounded-xl border bg-gradient-to-br',
                      TONE[feature.tone],
                    )}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[15.5px] font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{feature.body}</p>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </Card>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ChannelSection() {
  const channels = [
    {
      name: 'Sandbox',
      tag: 'No account needed',
      body: 'A complete in-app WhatsApp simulator. Same engine, same AI, same analytics - just no provider. Start here.',
      icon: Cpu,
      accent: 'mint',
      available: true,
    },
    {
      name: 'Meta Cloud API',
      tag: 'Direct from Meta',
      body: 'Connect a phone number ID and permanent token. Interactive reply buttons, signed webhooks, no reseller in the middle.',
      icon: Plug,
      accent: 'electric',
      available: true,
    },
    {
      name: 'Twilio',
      tag: 'Fastest to start',
      body: 'Point Twilio at your webhook URL and you are live on the number you already have, sandbox or production.',
      icon: Layers,
      accent: 'violet',
      available: true,
    },
  ];

  const ACCENT: Record<string, string> = {
    mint: 'border-mint-400/25 text-mint-300 shadow-[0_0_50px_-20px_rgba(0,212,127,0.7)]',
    electric: 'border-electric-400/25 text-electric-300 shadow-[0_0_50px_-20px_rgba(14,165,233,0.7)]',
    violet: 'border-violet-400/25 text-violet-300 shadow-[0_0_50px_-20px_rgba(139,92,246,0.7)]',
  };

  return (
    <section className="px-5 py-24 sm:px-8" id="channels">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Channels"
          title="Two ways to go live. One way to try it."
          description="You do not need a WhatsApp Business account to build the whole thing. When you are ready, connect Meta or Twilio without touching a single flow."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {channels.map((channel, index) => (
            <Reveal key={channel.name} delay={index * 0.09}>
              <Card hover className={cn('h-full border p-6', ACCENT[channel.accent])}>
                <div className="flex items-start justify-between">
                  <channel.icon className="h-6 w-6" />
                  <Badge tone={channel.accent as 'mint' | 'electric' | 'violet'}>{channel.tag}</Badge>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-white">{channel.name}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{channel.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-5 text-center sm:flex-row sm:text-left">
            <Fingerprint className="h-5 w-5 shrink-0 text-mint-400" />
            <p className="flex-1 text-[13.5px] leading-relaxed text-slate-400">
              Provider credentials are validated on save, encrypted with AES-256-GCM, and never returned by the API.
              The settings screen only ever tells you which fields are populated.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function AnalyticsSection() {
  const bars = [42, 58, 51, 74, 66, 88, 79, 96, 84, 108, 97, 124];

  return (
    <section className="px-5 py-24 sm:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <SectionHeading
            align="left"
            eyebrow="Analytics"
            title="Know which question is costing you customers"
            description="Completion rate, AI deflection, handoff rate and per-node reach - computed per workspace, cached, and never mixed between tenants."
          />

          <div className="mt-8 space-y-3">
            {[
              { icon: GitBranch, label: 'Per-node funnel', body: 'How many conversations reached each step, and where they stalled.' },
              { icon: Clock, label: 'Response latency', body: 'Provider round-trip measured on every outbound message.' },
              { icon: Users, label: 'Contact history', body: 'Every conversation a person has had, with captured variables attached.' },
            ].map((item, index) => (
              <Reveal key={item.label} delay={0.1 + index * 0.08}>
                <div className="flex gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-mint-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Conversations</p>
                <p className="mt-1 font-display text-3xl font-bold text-white">
                  <CountUp value={12480} />
                </p>
              </div>
              <Badge tone="mint" dot>
                +28% vs last period
              </Badge>
            </div>

            <div className="mt-8 flex h-40 items-end gap-2">
              {bars.map((height, index) => (
                <motion.div
                  key={index}
                  initial={{ height: 0 }}
                  whileInView={{ height: `${(height / 124) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-mint-500/25 to-mint-400/80"
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-5">
              {[
                { label: 'Completion', value: '68%' },
                { label: 'AI handled', value: '73%' },
                { label: 'Handoff', value: '9%' },
              ].map((metric) => (
                <div key={metric.label}>
                  <p className="text-[11px] text-slate-500">{metric.label}</p>
                  <p className="mt-0.5 font-display text-lg font-bold text-mint-300">{metric.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function PlatformSection() {
  const rows = [
    ['Tenancy', 'Workspace-scoped data, membership roles, invitations, workspace switching'],
    ['Security', 'JWT with rotating refresh tokens, bcrypt hashing, API keys, signed webhooks'],
    ['Limits', 'Global throttling plus per-plan message and AI quotas with live usage metering'],
    ['Operations', 'Health and readiness probes, structured request logs, OpenAPI docs, audit trail'],
    ['Deployment', 'One Dockerfile, one container, Postgres and optional Redis. Port 6002.'],
  ];

  return (
    <section className="px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Under the hood"
          title="Built to be run, not just demoed"
          description="NestJS and Prisma on the server, React and React Flow in the browser, shipped as a single self-contained image."
        />

        <Reveal delay={0.1}>
          <Card className="mt-12 divide-y divide-white/[0.06] overflow-hidden">
            {rows.map(([title, body]) => (
              <div key={title} className="grid gap-1 px-6 py-4 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-6">
                <p className="text-[13px] font-semibold text-mint-300">{title}</p>
                <p className="text-[13.5px] leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function FinalCta() {
  return (
    <section className="px-5 pb-24 pt-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="ring-glow relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 px-8 py-14 text-center sm:px-14">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-mint-500/20 blur-[90px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-violet-500/20 blur-[90px]" />

            <div className="relative">
              <Badge tone="mint" dot className="mb-6">
                Free forever on the sandbox plan
              </Badge>
              <h2 className="text-balance font-display text-3xl font-extrabold leading-tight text-white sm:text-[2.6rem]">
                Your first flow is ten minutes away.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-pretty text-[15.5px] leading-relaxed text-slate-400">
                Sign up, pick a template, and talk to your bot in the simulator before you connect a single provider.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link to="/register">
                  <Button size="lg" iconRight={ArrowRight}>
                    Create your workspace
                  </Button>
                </Link>
                <Link to="/templates">
                  <Button size="lg" variant="secondary">
                    Browse templates
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
