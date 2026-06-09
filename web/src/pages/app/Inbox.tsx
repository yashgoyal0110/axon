import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  Inbox as InboxIcon,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Input, Skeleton, Spinner, Tab, TabList, Tabs } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { ApiError, get, post } from '@/lib/api';
import { useCan } from '@/lib/store';
import type { Conversation, ConversationStatus, Message, Paginated } from '@/lib/types';
import { avatarGradient, cn, formatRelative, formatTime, initials } from '@/lib/utils';

const POLL_MS = 6000;

const STATUS_META: Record<ConversationStatus, { tone: 'mint' | 'slate' | 'amber' | 'rose'; label: string }> = {
  ACTIVE: { tone: 'mint', label: 'Active' },
  COMPLETED: { tone: 'slate', label: 'Completed' },
  HANDOFF: { tone: 'amber', label: 'Needs a human' },
  ABANDONED: { tone: 'rose', label: 'Abandoned' },
};

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const canReply = useCan('AGENT');

  const [filter, setFilter] = useState<'all' | ConversationStatus>('all');
  const [search, setSearch] = useState('');
  const [list, setList] = useState<Conversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('c'));
  const [detail, setDetail] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageAt = useRef<string | null>(null);

  const loadListValue = useCallback(async () => {
    const query = new URLSearchParams({ pageSize: '40' });
    if (filter !== 'all') query.set('status', filter);
    if (search.trim()) query.set('search', search.trim());
    try {
      const result = await get<Paginated<Conversation>>(`/conversations?${query}`);
      setList(result.items);
    } catch {
      setList([]);
    }
  }, [filter, search]);

  useEffect(() => {
    void loadListValue();
  }, [loadListValue]);

  // Debounce search so typing does not hammer the API.
  useEffect(() => {
    const timer = setTimeout(() => void loadListValue(), 320);
    return () => clearTimeout(timer);
  }, [search, loadListValue]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const conversation = await get<Conversation>(`/conversations/${id}`);
      setDetail(conversation);
      setMessages(conversation.messages ?? []);
      lastMessageAt.current = conversation.messages?.at(-1)?.createdAt ?? null;
    } catch {
      toast.error('That conversation could not be loaded');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // Lightweight polling for new messages on the open conversation.
    useEffect(() => {
        if (!selectedId) return;
        const timer = setInterval(async () => {
            try {
                const result = await get<{ messages: Message[]; status: ConversationStatus }>(
                    `/conversations/${selectedId}/messages${lastMessageAt.current ? `?since=${encodeURIComponent(lastMessageAt.current)}` : ''}`,
                );
                if (result.messages.length) {
                    setMessages((prev) => [...prev, ...result.messages]);
                    lastMessageAt.current = result.messages.at(-1)?.createdAt ?? lastMessageAt.current;
                }
                setDetail((prev) => (prev ? { ...prev, status: result.status } : prev));
            } catch {
                /* transient - the next tick retries */
            }
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [selectedId]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const select = (id: string) => {
        setSelectedId(id);
        setParams({ c: id });
    };

    const sendReply = async () => {
        if (!reply.trim() || !selectedId) return;
        setSending(true);
        try {
            await post(`/conversations/${selectedId}/reply`, { text: reply.trim() });
            setReply('');
            await loadDetail(selectedId);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : 'Could not send');
        } finally {
            setSending(false);
        }
    };

    const setStatus = async (status: ConversationStatus) => {
        if (!selectedId) return;
        try {
            await post(`/conversations/${selectedId}/status`, { status });
            setDetail((prev) => (prev ? { ...prev, status } : prev));
            void loadListValue();
            toast.success(`Marked ${STATUS_META[status].label.toLowerCase()}`);
        } catch (error) {
            toast.error(error instanceof ApiError ? error.message : 'Could not update');
        }
    };

    return (
        <PageShell className="max-w-none">
            <PageHeader
                title="Inbox"
                description="Every conversation across every channel. Jump in whenever a human is needed."
                actions={
                    <Button variant="secondary" icon={RefreshCw} onClick={() => void loadListValue()}>
                        Refresh
                    </Button>
                }
            />

            <div className="grid gap-4 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr]">
                {/* List */}
                <Card className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden">
                    <div className="space-y-2.5 border-b border-white/[0.07] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or number"
                className="h-9 pl-9 text-[12.5px]"
              />
            </div>
            <Tabs value={filter} onChange={(v) => setFilter(v as typeof filter)}>
              <TabList>
                <Tab value="all">All</Tab>
                <Tab value="ACTIVE">Active</Tab>
                <Tab value="HANDOFF">Handoff</Tab>
                <Tab value="COMPLETED">Done</Tab>
              </TabList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!list ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={InboxIcon}
                title="Nothing here yet"
                description="Conversations appear as soon as someone messages your bot - including from the simulator."
              />
            ) : (
              <div className="p-2">
                {list.map((conversation, index) => (
                  <motion.button
                    key={conversation.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                    onClick={() => select(conversation.id)}
                    className={cn(
                      'flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      selectedId === conversation.id ? 'bg-mint-400/[0.09]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-ink-950',
                        avatarGradient(conversation.contact.id),
                      )}
                    >
                      {initials(conversation.contact.name ?? conversation.contact.waId.slice(-2))}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-slate-200">
                          {conversation.contact.name ?? conversation.contact.waId}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-slate-600">
                          {formatRelative(conversation.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                        {conversation.lastMessage?.body ?? 'No messages'}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <Badge tone={STATUS_META[conversation.status].tone}>
                          {STATUS_META[conversation.status].label}
                        </Badge>
                        {conversation.flow && (
                          <span className="truncate text-[10px] text-slate-600">{conversation.flow.name}</span>
                        )}
                      </span>
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Detail */}
        <Card className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden">
          {!selectedId ? (
            <EmptyState
              icon={Users}
              title="Pick a conversation"
              description="Choose someone on the left to read the full transcript and reply."
            />
          ) : loadingDetail && !detail ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : detail ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-ink-950',
                    avatarGradient(detail.contact.id),
                  )}
                >
                  {initials(detail.contact.name ?? detail.contact.waId.slice(-2))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-white">
                    {detail.contact.name ?? detail.contact.waId}
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-600">
                    {detail.contact.waId} · {detail.channel.name}
                  </p>
                </div>
                <Badge tone={STATUS_META[detail.status].tone}>{STATUS_META[detail.status].label}</Badge>
              </div>

              {/* Captured variables */}
              {Object.keys(detail.variables ?? {}).length > 0 && (
                <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-b border-white/[0.07] bg-white/[0.02] px-4 py-2">
                  {Object.entries(detail.variables)
                    .filter(([, value]) => value !== '' && value !== null)
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <span
                        key={key}
                        className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-400"
                      >
                        {key}: <span className="text-mint-300">{String(value).slice(0, 24)}</span>
                      </span>
                    ))}
                </div>
              )}

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-[#0b141a] p-4">
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const outbound = message.direction === 'OUTBOUND';
                    const buttons = (message.payload as { buttons?: string[] } | null)?.buttons ?? [];
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn('flex', outbound ? 'justify-start' : 'justify-end')}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] rounded-lg px-2.5 py-1.5',
                            outbound ? 'rounded-tl-sm bg-[#202c33]' : 'rounded-tr-sm bg-[#005c4b]',
                          )}
                        >
                          {outbound && (
                            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wide text-slate-500">
                              {message.source.toLowerCase()}
                            </span>
                          )}
                          <p className="whitespace-pre-wrap text-[12.5px] leading-snug text-slate-100">
                            {message.body}
                          </p>
                          {buttons.length > 0 && (
                            <div className="mt-1.5 space-y-1 border-t border-white/[0.08] pt-1.5">
                              {buttons.map((button) => (
                                <div
                                  key={button}
                                  className="rounded bg-white/[0.05] px-2 py-1 text-center text-[11px] text-[#53bdeb]"
                                >
                                  {button}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="mt-0.5 text-right text-[9px] text-slate-400/70">
                            {formatTime(message.createdAt)}
                            {message.status === 'FAILED' && <span className="ml-1 text-rose-400">failed</span>}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <div className="border-t border-white/[0.07] p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {detail.status !== 'HANDOFF' && (
                    <Button variant="ghost" size="sm" icon={UserCheck} onClick={() => setStatus('HANDOFF')}>
                      Take over
                    </Button>
                  )}
                  {detail.status === 'HANDOFF' && (
                    <Button variant="ghost" size="sm" icon={Bot} onClick={() => setStatus('ACTIVE')}>
                      Hand back to bot
                    </Button>
                  )}
                  {detail.status !== 'COMPLETED' && (
                    <Button variant="ghost" size="sm" icon={CheckCircle2} onClick={() => setStatus('COMPLETED')}>
                      Mark done
                    </Button>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendReply();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={canReply ? 'Reply as a human agent…' : 'Your role cannot send messages'}
                    disabled={!canReply}
                  />
                  <Button type="submit" icon={Send} loading={sending} disabled={!canReply || !reply.trim()}>
                    Send
                  </Button>
                </form>
              </div>
            </>
          ) : null}
        </Card>
      </div>
    </PageShell>
  );
}


// kept around until the new implementation is verified
const legacySTATUS_META: Record<ConversationStatus, { tone: 'mint' | 'slate' | 'amber' | 'rose'; label: string }> = {
  ACTIVE: { tone: 'mint', label: 'Active' },
  COMPLETED: { tone: 'slate', label: 'Completed' },
  HANDOFF: { tone: 'amber', label: 'Needs a human' },
  ABANDONED: { tone: 'rose', label: 'Abandoned' },
};