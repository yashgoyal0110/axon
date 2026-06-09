import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Check, CheckCheck, RotateCcw, Send, Sparkles, User, Workflow, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Card, Field, Input, Select, Spinner } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { ApiError, get, post } from '@/lib/api';
import type { Channel, Flow, Message } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';

const SIM_NUMBER = '+15550000001';

const SOURCE_META: Record<Message['source'], { label: string; tone: string }> = {
  FLOW: { label: 'flow', tone: 'text-electric-300 bg-electric-400/10' },
  AI: { label: 'AI', tone: 'text-violet-300 bg-violet-400/10' },
  AGENT: { label: 'agent', tone: 'text-mint-300 bg-mint-400/10' },
  SYSTEM: { label: 'system', tone: 'text-slate-400 bg-white/[0.06]' },
};

export default function Simulator() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState<string>('');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [status, setStatus] = useState<string>('ACTIVE');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void Promise.all([
      get<Channel[]>('/channels').then((list) => {
        setChannels(list);
        const sandbox = list.find((c) => c.provider === 'SANDBOX') ?? list[0];
        if (sandbox) setChannelId(sandbox.id);
      }),
      get<Flow[]>('/flows').then(setFlows),
    ]).catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput('');

    // Optimistic echo so the bubble appears the instant you press send.
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId: '',
      direction: 'INBOUND',
      source: 'SYSTEM',
      body: text.trim(),
      nodeId: null,
      status: 'DELIVERED',
      error: null,
      latencyMs: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const result = await post<{ messages: Message[]; status: string }>('/conversations/simulate', {
        text: text.trim(),
        waId: SIM_NUMBER,
        channelId: channelId || undefined,
      });
      setMessages(result.messages);
      setStatus(result.status);
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error(error instanceof ApiError ? error.message : 'The simulator could not reach the engine');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    try {
      await post('/conversations/simulate/reset', { waId: SIM_NUMBER });
      setMessages([]);
      setStatus('ACTIVE');
      setCurrentNodeId(null);
      toast.success('Session reset');
    } catch {
      toast.error('Could not reset the session');
    }
  };

  const activeChannel = channels.find((c) => c.id === channelId);
    const activeFlow = flows.find((f) => f.id === activeChannel?.flowId) ?? flows.find((f) => f.isDefault);
    const lastBotMessage = [...messages].reverse().find((m) => m.direction === 'OUTBOUND');
    const quickReplies = (lastBotMessage?.payload as { buttons?: string[] } | null)?.buttons ?? [];

    return (
        <PageShell>
            <PageHeader
                title="Simulator"
                description="Talk to your bot exactly as a WhatsApp contact would. Same engine, same AI, no provider needed."
                badge={<Badge tone="mint" dot>sandbox</Badge>}
                actions={
                    <Button variant="secondary" icon={RotateCcw} onClick={reset}>
                        Reset session
                    </Button>
                }
            />

            <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
                <div className="space-y-4">
                    <Card className="p-5">
                        <h3 className="mb-4 text-[14px] font-semibold text-white">Session</h3>
                        <div className="space-y-3">
                            <Field label="Channel">
                                <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                                    {channels.map((channel) => (
                                        <option key={channel.id} value={channel.id}>
                                            {channel.name} · {channel.provider.replace('_', ' ').toLowerCase()}
                                        </option>
                                    ))}
                                </Select>
                            </Field>

              <Field label="Simulated contact">
                <Input value={SIM_NUMBER} readOnly className="font-mono text-[12.5px] text-slate-500" />
              </Field>
            </div>

            <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-4 text-[12.5px]">
              <Row label="Answering flow" value={activeFlow?.name ?? 'None assigned'} />
              <Row label="Conversation status" value={status.toLowerCase()} />
              <Row label="Messages exchanged" value={String(messages.length)} />
            </div>

            {activeFlow && (
              <Link to={`/app/flows/${activeFlow.id}`} className="mt-4 block">
                <Button variant="secondary" size="sm" icon={Workflow} className="w-full">
                  Edit this flow
                </Button>
              </Link>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-white">
              <Zap className="h-3.5 w-3.5 text-mint-400" />
              What to try
            </h3>
            <div className="space-y-1.5">
              {['hi', 'I need help with my order', 'what are your prices?', 'talk to a human'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  disabled={busy}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[12.5px] text-slate-400 transition-colors hover:border-mint-400/25 hover:bg-mint-400/[0.06] hover:text-mint-200 disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-slate-600">
              Everything you send here lands in the inbox and counts toward analytics, exactly like production traffic.
            </p>
          </Card>
        </div>

        <Card className="flex h-[640px] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-white/[0.07] bg-[#202c33] px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-emerald-700 text-[12px] font-bold text-ink-950">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-100">{activeFlow?.name ?? 'Your bot'}</p>
              <p className="text-[10.5px] text-mint-400">{busy ? 'typing…' : 'online'}</p>
            </div>
            <Badge tone="slate">{activeChannel?.provider.replace('_', ' ').toLowerCase() ?? 'sandbox'}</Badge>
          </div>

          <div
            ref={scrollRef}
            className="relative flex-1 space-y-2 overflow-y-auto bg-[#0b141a] p-4"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.04' stroke-width='1.2'%3E%3Ccircle cx='20' cy='20' r='6'/%3E%3Cpath d='M50 14h14v10H56l-4 5v-5h-2z'/%3E%3Cpath d='M12 56l6-6 6 6-6 6z'/%3E%3C/g%3E%3C/svg%3E\")",
            }}
          >
            {messages.length === 0 && !busy && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles className="mb-3 h-8 w-8 text-mint-400/50" />
                <p className="text-[13.5px] font-medium text-slate-400">Say hello to start</p>
                <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-slate-600">
                  The engine will resolve a contact, open a session and walk your published flow from its Start node.
                </p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((message) => {
                const outbound = message.direction === 'OUTBOUND';
                const buttons = (message.payload as { buttons?: string[] } | null)?.buttons ?? [];
                const tmpMeta = SOURCE_META[message.source];

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={cn('flex', outbound ? 'justify-start' : 'justify-end')}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm',
                        outbound ? 'rounded-tl-sm bg-[#202c33]' : 'rounded-tr-sm bg-[#005c4b]',
                      )}
                    >
                      {outbound && (
                        <span
                          className={cn(
                            'mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                            tmpMeta.tone,
                          )}
                        >
                          {tmpMeta.label}
                        </span>
                      )}

                      <p className="whitespace-pre-wrap text-[12.5px] leading-snug text-slate-100">{message.body}</p>

                      {buttons.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-white/[0.08] pt-2">
                          {buttons.map((button) => (
                            <button
                              key={button}
                              onClick={() => void send(button)}
                              disabled={busy}
                              className="block w-full rounded bg-white/[0.05] px-2 py-1.5 text-center text-[11.5px] font-medium text-[#53bdeb] transition-colors hover:bg-white/[0.1] disabled:opacity-40"
                            >
                              {button}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="mt-0.5 flex items-center justify-end gap-1">
                        {message.latencyMs !== null && outbound && (
                          <span className="text-[9px] text-slate-500">{message.latencyMs}ms</span>
                        )}
                        <span className="text-[9px] text-slate-400/70">{formatTime(message.createdAt)}</span>
                        {!outbound &&
                          (message.status === 'DELIVERED' ? (
                            <CheckCheck className="h-2.5 w-2.5 text-[#53bdeb]" />
                          ) : (
                            <Check className="h-2.5 w-2.5 text-slate-400/70" />
                          ))}
                      </div>

                      {message.status === 'FAILED' && message.error && (
                        <p className="mt-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">
                          {message.error}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg rounded-tl-sm bg-[#202c33] px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-slate-500"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2.5, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {quickReplies.length > 0 && !busy && (
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-t border-white/[0.07] bg-ink-900/60 px-3 py-2">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  onClick={() => void send(reply)}
                  className="shrink-0 rounded-full border border-mint-400/25 bg-mint-400/[0.08] px-3 py-1 text-[11.5px] font-medium text-mint-300 hover:bg-mint-400/[0.15]"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-white/[0.07] bg-[#202c33] px-3 py-2.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <User className="h-3.5 w-3.5 text-slate-500" />
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message as the contact…"
              className="flex-1 rounded-full bg-[#2a3942] px-3.5 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint-500 text-ink-950 transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            >
              {busy ? <Spinner className="h-3.5 w-3.5 text-ink-950" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate font-medium text-slate-300">{value}</span>
    </div>
  );
}


// kept around until the new implementation is verified
const SOURCE_METALegacy: Record<Message['source'], { label: string; tone: string }> = {
  FLOW: { label: 'flow', tone: 'text-electric-300 bg-electric-400/10' },
  AI: { label: 'AI', tone: 'text-violet-300 bg-violet-400/10' },
  AGENT: { label: 'agent', tone: 'text-mint-300 bg-mint-400/10' },
  SYSTEM: { label: 'system', tone: 'text-slate-400 bg-white/[0.06]' },
};