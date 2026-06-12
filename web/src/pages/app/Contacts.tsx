import { motion } from 'framer-motion';
import { Ban, Download, Search, Tag, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Skeleton, Toggle } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { ApiError, api, del, get, patch } from '@/lib/api';
import { useCan } from '@/lib/store';
import type { Contact, Conversation, Paginated } from '@/lib/types';
import { avatarGradient, cn, formatDate, formatRelative, initials } from '@/lib/utils';

export default function Contacts() {
  const canEdit = useCan('AGENT');
  const canDelete = useCan('ADMIN');

  const [contacts, setContacts] = useState<Paginated<Contact> | null>(null);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (search.trim()) query.set('search', search.trim());
    if (tag) query.set('tag', tag);
    try {
      setContacts(await get<Paginated<Contact>>(`/contacts?${query}`));
    } catch {
      setContacts(null);
    }
  }, [page, search, tag]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 280);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    void get<string[]>('/contacts/tags').then(setTags).catch(() => undefined);
  }, []);

  const exportCsv = async () => {
    try {
      const csv = await api<string>('/contacts/export.csv', { raw: true });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contacts.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Contacts"
        description="Everyone who has messaged your bots, with the variables each conversation captured."
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or number"
              className="pl-10"
            />
          </div>
          {tags.length > 0 && (
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
              <button
                onClick={() => setTag('')}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors',
                  !tag ? 'border-mint-400/30 bg-mint-400/10 text-mint-300' : 'border-white/[0.07] text-slate-400',
                )}
              >
                All
              </button>
              {tags.map((item) => (
                <button
                  key={item}
                  onClick={() => setTag(item === tag ? '' : item)}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors',
                    tag === item ? 'border-mint-400/30 bg-mint-400/10 text-mint-300' : 'border-white/[0.07] text-slate-400',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {!contacts ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : contacts.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Contacts are created automatically the first time someone messages your bot."
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[1fr_140px_120px_120px_40px] gap-4 border-b border-white/[0.07] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 md:grid">
              <span>Contact</span>
              <span>Tags</span>
              <span>Conversations</span>
              <span>Last seen</span>
              <span />
            </div>

            <div className="divide-y divide-white/[0.05]">
              {contacts.items.map((contact, index) => (
                <motion.button
                  key={contact.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  onClick={() => setSelected(contact)}
                  className="grid w-full grid-cols-1 gap-2 px-5 py-3 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[1fr_140px_120px_120px_40px] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-ink-950',
                        avatarGradient(contact.id),
                      )}
                    >
                      {initials(contact.name ?? contact.waId.slice(-2))}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-slate-200">
                        {contact.name ?? 'Unnamed contact'}
                      </span>
                      <span className="block truncate font-mono text-[11.5px] text-slate-600">{contact.waId}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {contact.optedOut && <Badge tone="rose">opted out</Badge>}
                    {contact.tags.slice(0, 2).map((item) => (
                      <Badge key={item} tone="slate">
                        {item}
                      </Badge>
                    ))}
                  </div>

                  <span className="text-[12.5px] text-slate-400">{contact._count?.conversations ?? 0}</span>
                  <span className="text-[12.5px] text-slate-500">{formatRelative(contact.lastSeenAt)}</span>
                  <span />
                </motion.button>
              ))}
            </div>
          </Card>

          {contacts.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[12.5px] text-slate-500">
                Page {contacts.page} of {contacts.totalPages} · {contacts.total} contacts
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= contacts.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ContactModal
        contact={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          void load();
          setSelected(null);
        }}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </PageShell>
  );
}

function ContactModal({
  contact,
  onClose,
  onChanged,
  canEdit,
  canDelete,
}: {
  contact: Contact | null;
  onClose: () => void;
  onChanged: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [detail, setDetail] = useState<(Contact & { conversations: Conversation[] }) | null>(null);
  const [name, setName] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [optedOut, setOptedOut] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!contact) return;
    setDetail(null);
    setName(contact.name ?? '');
    setTagInput(contact.tags.join(', '));
    setOptedOut(contact.optedOut);
    void get<Contact & { conversations: Conversation[] }>(`/contacts/${contact.id}`)
      .then(setDetail)
      .catch(() => undefined);
  }, [contact]);

  if (!contact) return null;

  const save = async () => {
    setBusy(true);
    try {
      await patch(`/contacts/${contact.id}`, {
        name: name || undefined,
        tags: tagInput.split(',').map((s) => s.trim()).filter(Boolean),
        optedOut,
      });
      toast.success('Contact updated');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await del(`/contacts/${contact.id}`);
      toast.success('Contact deleted');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete');
    }
  };

  const attributes = Object.entries((detail?.attributes ?? {}) as Record<string, unknown>);

  return (
    <Modal
      open={!!contact}
      onClose={onClose}
      title={contact.name ?? contact.waId}
      description={`First seen ${formatDate(contact.createdAt)}`}
      size="lg"
      footer={
        <>
          {canDelete && (
            <Button variant="danger" icon={Trash2} onClick={remove} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} loading={busy} disabled={!canEdit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field label="WhatsApp number">
            <Input value={contact.waId} readOnly className="font-mono text-slate-500" />
          </Field>
        </div>

        <Field label="Tags" hint="Comma separated.">
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="vip, newsletter"
              className="pl-9"
              disabled={!canEdit}
            />
          </div>
        </Field>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <Toggle
            checked={optedOut}
            onChange={setOptedOut}
            label="Opted out"
            description="The engine ignores inbound messages from opted-out contacts and never sends to them."
            disabled={!canEdit}
          />
        </div>

        {attributes.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-300">Captured attributes</p>
            <div className="flex flex-wrap gap-1.5">
              {attributes.map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 font-mono text-[10.5px] text-slate-400"
                >
                  {key}: <span className="text-mint-300">{String(value)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-300">Recent conversations</p>
          {!detail ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : detail.conversations.length === 0 ? (
            <p className="text-[12.5px] text-slate-600">No conversations yet.</p>
          ) : (
            <div className="space-y-1.5">
              {detail.conversations.slice(0, 6).map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-300">
                    {conversation.flow?.name ?? 'No flow'}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-600">
                    {formatRelative(conversation.lastMessageAt)}
                  </span>
                  <Badge tone={conversation.status === 'COMPLETED' ? 'mint' : 'slate'}>
                    {conversation.status.toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
