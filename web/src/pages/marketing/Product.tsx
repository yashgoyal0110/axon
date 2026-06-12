import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Building2,
  Gauge,
  GitBranch,
  Inbox,
  MessageSquare,
  PlayCircle,
  Radio,
  Save,
  ScrollText,
  Send,
  Sparkles,
  Split,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Reveal, SectionHeading } from '@/components/ui';
import { FlowCanvasPreview } from '@/components/marketing/FlowCanvasPreview';
import { PhoneMockup } from '@/components/marketing/PhoneMockup';
import { cn } from '@/lib/utils';

const NODE_TYPES = [
  { icon: PlayCircle, name: 'Start', body: 'The single entry point. Trigger keywords route contacts in.', tone: 'mint' },
  { icon: MessageSquare, name: 'Message', body: 'Sends text and moves straight on.', tone: 'electric' },
  { icon: Radio, name: 'Question', body: 'Text plus quick replies, then waits for an answer.', tone: 'electric' },
  { icon: Save, name: 'Capture', body: 'Stores a free-text reply into a named variable.', tone: 'amber' },
  { icon: Sparkles, name: 'AI', body: 'Gemini answers in your persona, then hands back.', tone: 'violet' },
  { icon: Split, name: 'Condition', body: 'Branches on captured values. First match wins.', tone: 'amber' },
  { icon: UserCheck, name: 'Handoff', body: 'Parks the conversation for a human agent.', tone: 'rose' },
  { icon: Bot, name: 'End', body: 'Closing message, conversation marked complete.', tone: 'rose' },
] as const;

const TONE: Record<string, string> = {
  mint: 'border-mint-400/25 bg-mint-400/[0.07] text-mint-300',
  electric: 'border-electric-400/25 bg-electric-400/[0.07] text-electric-300',
  violet: 'border-violet-400/25 bg-violet-400/[0.07] text-violet-300',
  amber: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300',
  rose: 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300',
};

export default function Product() {
  return (
    <div className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-28">
        <div>
          <SectionHeading
            eyebrow="How it works"
            title="Four screens, one loop"
            description="Build the conversation, test it against the real engine, connect a number, then read the numbers and tighten the flow."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '01', icon: GitBranch, title: 'Build', body: 'Drag nodes onto the canvas, or let AI draft the whole flow from a description.' },
              { step: '02', icon: PlayCircle, title: 'Test', body: 'Talk to your bot in the simulator. Same engine, same AI, no provider needed.' },
              { step: '03', icon: Send, title: 'Ship', body: 'Publish an immutable version, connect Meta or Twilio, point the webhook at Axon.' },
              { step: '04', icon: Gauge, title: 'Improve', body: 'Watch per-node drop-off, see what AI absorbed, and edit without breaking live sessions.' },
            ].map((item, index) => (
              <Reveal key={item.step} delay={index * 0.08}>
                <Card hover className='h-full p-6'>
                  <span className='font-mono text-[11px] font-bold text-mint-400/60'>{item.step}</span>
                  <item.icon className='mt-3 h-5 w-5 text-mint-300' />
                  <h3 className='mt-4 text-[15px] font-semibold text-white'>{item.title}</h3>
                  <p className='mt-2 text-[13.5px] leading-relaxed text-slate-400'>{item.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>

        <div className='grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]'>
          <Reveal>
            <FlowCanvasPreview />
          </Reveal>
          <Reveal delay={0.1}>
            <SectionHeading
              align="left"
              eyebrow="The canvas"
              title="Eight node types, no configuration files"
              description="Enough primitives to model a real support or sales conversation - and nothing you have to learn a DSL for."
            />
            <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {NODE_TYPES.map((node, index) => (
                <motion.div
                  key={node.name}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                  className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', TONE[node.tone])}>
                    <node.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white">{node.name}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{node.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="The engine"
              title="What happens when a message arrives"
              description="One code path serves every provider, so the sandbox and production behave identically."
            />
            <ol className="mt-8 space-y-4">
              {[
                'The webhook signature is verified - HMAC-SHA256 for Meta, HMAC-SHA1 for Twilio.',
                'A redelivery guard drops any provider message id already processed.',
                'The contact is resolved or created, and the 24-hour session window is checked.',
                'The flow advances node by node until it hits a step that waits for a reply.',
                'Anything unmatched goes to Gemini with the transcript and your persona.',
                'Replies dispatch through the provider, and usage, latency and daily stats are metered.',
              ].map((item, index) => (
                <Reveal key={item} delay={index * 0.06}>
                  <li className="flex gap-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-mint-400/25 bg-mint-400/10 font-mono text-[11px] font-bold text-mint-300">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-[14px] leading-relaxed text-slate-400">{item}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={0.12}>
            <PhoneMockup
              botName="Acme Support"
              status="online"
              script={[
                { from: 'user', text: 'where is my order?', delay: 700 },
                {
                  from: 'bot',
                  text: 'Hi! Happy to check. What do you need a hand with?',
                  buttons: ['Order status', 'Billing question', 'Something else'],
                  delay: 1300,
                },
                { from: 'user', text: 'Order status', delay: 1400 },
                { from: 'bot', text: 'Sure - what is your order number?', delay: 1200 },
                { from: 'user', text: 'AC-88214', delay: 1500 },
                {
                  from: 'bot',
                  text: 'Thanks. Order AC-88214 shipped this morning and is out for delivery - arriving before 6pm today. 📦',
                  delay: 1500,
                },
              ]}
            />
          </Reveal>
        </div>

        <div>
          <SectionHeading
            eyebrow="Operations"
            title="The unglamorous parts, done"
            description="The difference between a portfolio project and something a customer will pay for."
          />

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Building2,
                title: 'Workspaces',
                items: ['Tenant-scoped queries everywhere', 'Owner / admin / agent / viewer roles', 'Invitation links with expiry', 'One-click workspace switching'],
              },
              {
                icon: Inbox,
                title: 'Live inbox',
                items: ['Every conversation, filterable by status', 'Reply as a human mid-flow', 'Hand back to the bot when done', 'Full transcript with node attribution'],
              },
              {
                icon: ScrollText,
                title: 'Accountability',
                items: ['Audit log of every mutation', 'Per-message delivery status and latency', 'Immutable published flow versions', 'CSV contact export'],
              },
            ].map((group, index) => (
              <Reveal key={group.title} delay={index * 0.08}>
                <Card hover className="h-full p-6">
                  <group.icon className="h-5 w-5 text-mint-300" />
                  <h3 className="mt-4 text-[15px] font-semibold text-white">{group.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-400">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mint-400/70" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-ink-850 to-ink-950 px-8 py-12 text-center">
            <Badge tone="mint" dot className="mb-5">
              Sandbox included on every plan
            </Badge>
            <h2 className="font-display text-3xl font-extrabold text-white">See it running in your own workspace</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-slate-400">
              No credit card, no WhatsApp account, no waiting on Meta approval.
            </p>
            <Link to="/register" className="mt-8 inline-block">
              <Button size="lg" iconRight={ArrowRight}>
                Start free
              </Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}


// kept around until the new implementation is verified
const legacyTONE: Record<string, string> = {
  mint: 'border-mint-400/25 bg-mint-400/[0.07] text-mint-300',
  electric: 'border-electric-400/25 bg-electric-400/[0.07] text-electric-300',
  violet: 'border-violet-400/25 bg-violet-400/[0.07] text-violet-300',
  amber: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300',
  rose: 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300',
};