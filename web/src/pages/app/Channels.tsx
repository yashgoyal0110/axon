import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  Layers,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { ApiError, del, get, patch, post } from '@/lib/api';
import { useCan } from '@/lib/store';
import type { Channel, ChannelProvider, Flow, ProviderInfo } from '@/lib/types';
import { cn, copyToClipboard, formatRelative } from '@/lib/utils';

const PROVIDER_META: Record<ChannelProvider, { label: string; icon: typeof Cpu; blurb: string; accent: string }> = {
  SANDBOX: {
    label: 'Sandbox',
    icon: Cpu,
    blurb: 'Runs entirely in-app. No credentials, no provider - ideal for building and demoing.',
    accent: 'mint',
  },
  META_CLOUD: {
    label: 'Meta Cloud API',
    icon: Plug,
    blurb: 'Direct from Meta. Interactive reply buttons and signed webhooks.',
    accent: 'electric',
  },
  TWILIO: {
    label: 'Twilio',
    icon: Layers,
    blurb: 'Fastest if you already have a Twilio number or their WhatsApp sandbox.',
    accent: 'violet',
  },
};

export default function Channels() {
  const canManage = useCan('ADMIN');
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);

  const load = () =>
    Promise.all([
      get<Channel[]>('/channels').then(setChannels),
      get<ProviderInfo[]>('/channels/providers').then(setProviders),
      get<Flow[]>('/flows').then(setFlows),
    ]).catch(() => setChannels([]));

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Channels"
        description="Where your bots meet real people. Start with the sandbox, connect a provider when you're ready."
        actions={
          canManage && (
            <Button icon={Plus} onClick={() => setShowConnect(true)}>
              Connect a channel
            </Button>
          )
        }
      />

      {!channels ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <Card>
          <EmptyState
            icon={Plug}
            title="No channels yet"
            description="Every workspace normally starts with a sandbox channel. Connect one to begin."
            action={canManage && <Button icon={Plus} onClick={() => setShowConnect(true)}>Connect a channel</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel, index) => (
            <motion.div
              key={channel.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <ChannelCard
                channel={channel}
                flows={flows}
                canManage={canManage}
                onChanged={load}
                onEdit={() => setEditing(channel)}
              />
            </motion.div>
          ))}
        </div>
      )}

      <ConnectModal
        open={showConnect}
        onClose={() => setShowConnect(false)}
        providers={providers}
        flows={flows}
        onCreated={() => {
          void load();
          setShowConnect(false);
        }}
      />

      <EditModal
        channel={editing}
        providers={providers}
        flows={flows}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void load();
          setEditing(null);
        }}
      />
    </PageShell>
  );
}

function ChannelCard({
  channel,
  flows,
  canManage,
  onChanged,
  onEdit,
}: {
  channel: Channel;
  flows: Flow[];
  canManage: boolean;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const meta = PROVIDER_META[channel.provider];
  const Icon = meta.icon;
  const [testing, setTesting] = useState(false);

  const testList = async () => {
    setTesting(true);
    try {
      const result = await post<{ ok: boolean; message: string }>(`/channels/${channel.id}/test`, {});
      toast[result.ok ? 'success' : 'error'](result.message);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    try {
      await del(`/channels/${channel.id}`);
      toast.success('Channel disconnected');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not disconnect');
    }
  };

  const setFlow = async (flowId: string) => {
    try {
      await patch(`/channels/${channel.id}`, { flowId: flowId || null });
      toast.success('Flow assigned');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not assign the flow');
    }
  };

  const statusTone =
    channel.status === 'ACTIVE' ? 'mint' : channel.status === 'ERROR' ? 'rose' : channel.status === 'PENDING' ? 'amber' : 'slate';

  return (
    <Card hover className="h-full p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border',
              meta.accent === 'mint' && 'border-mint-400/25 bg-mint-400/[0.08] text-mint-300',
              meta.accent === 'electric' && 'border-electric-400/25 bg-electric-400/[0.08] text-electric-300',
              meta.accent === 'violet' && 'border-violet-400/25 bg-violet-400/[0.08] text-violet-300',
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-white">{channel.name}</p>
            <p className="text-[11.5px] text-slate-500">
              {meta.label}
              {channel.phoneNumber && ` · ${channel.phoneNumber}`}
            </p>
          </div>
        </div>
        <Badge tone={statusTone as 'mint'} dot>
          {channel.status.toLowerCase()}
        </Badge>
      </div>

      {channel.lastError && (
        <div className="mt-3 flex gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.07] px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <div className="min-w-0">
            <p className="break-words text-[11.5px] leading-relaxed text-rose-300">{channel.lastError}</p>
            {channel.lastErrorAt && (
              <p className="mt-0.5 text-[10.5px] text-rose-400/60">{formatRelative(channel.lastErrorAt)}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        <Field label="Answering flow">
          <Select value={channel.flowId ?? ''} onChange={(e) => setFlow(e.target.value)} disabled={!canManage}>
            <option value="">Workspace default</option>
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name} {flow.status !== 'PUBLISHED' ? '(draft)' : ''}
              </option>
            ))}
          </Select>
        </Field>

        {channel.webhookUrl && (
          <div>
            <p className="mb-1 text-[12px] font-medium text-slate-400">Webhook URL</p>
            <CopyRow value={channel.webhookUrl} />
            {channel.verifyToken && (
              <>
                <p className="mb-1 mt-2 text-[12px] font-medium text-slate-400">Verify token</p>
                <CopyRow value={channel.verifyToken} />
              </>
            )}
          </div>
        )}

        {channel.configuredFields.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {channel.configuredFields.map((field) => (
              <span
                key={field}
                className="flex items-center gap-1 rounded-md border border-mint-400/20 bg-mint-400/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-mint-300"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                {field}
              </span>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
          <Button variant="secondary" size="sm" icon={Zap} loading={testing} onClick={testList}>
            Test
          </Button>
          {channel.provider !== 'SANDBOX' && (
            <>
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onEdit}>
                Credentials
              </Button>
              <Button variant="ghost" size="sm" icon={Trash2} className="ml-auto text-rose-400" onClick={remove}>
                Disconnect
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function CopyRow({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-ink-950/60 px-2.5 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-400">{value}</code>
      <button
        onClick={async () => {
          const ok = await copyToClipboard(value);
          toast[ok ? 'success' : 'error'](ok ? 'Copied' : 'Copy failed');
        }}
        className="shrink-0 text-slate-600 transition-colors hover:text-mint-300"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function ConnectModal({
  open,
  onClose,
  providers,
  flows,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  providers: ProviderInfo[];
  flows: Flow[];
  onCreated: () => void;
}) {
  const [provider, setProvider] = useState<ChannelProvider>('TWILIO');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [flowId, setFlowId] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProvider('TWILIO');
    setName('');
    setPhoneNumber('');
    setFlowId('');
    setCredentials({});
  }, [open]);

  const info = providers.find((p) => p.provider === provider);

  const create = async () => {
    setBusy(true);
    try {
      await post('/channels', {
        name: name.trim() || PROVIDER_META[provider].label,
        provider,
        phoneNumber: phoneNumber.trim() || undefined,
        flowId: flowId || undefined,
        credentials: info?.requiresCredentials ? credentials : undefined,
      });
      toast.success('Channel connected');
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not connect the channel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect a channel"
      description="Credentials are encrypted before they are stored and are never read back."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} loading={busy}>
            Connect
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(PROVIDER_META) as ChannelProvider[]).map((key) => {
            const meta = PROVIDER_META[key];
            const Icon = meta.icon;
            return (
              <button
                key={key}
                onClick={() => setProvider(key)}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition-colors',
                  provider === key
                    ? 'border-mint-400/40 bg-mint-400/[0.08]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
                )}
              >
                <Icon className="h-4 w-4 text-mint-300" />
                <p className="mt-2 text-[13px] font-semibold text-white">{meta.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{meta.blurb}</p>
              </button>
            );
          })}
        </div>

        <Field label="Channel name" hint="How it appears in your workspace.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={PROVIDER_META[provider].label} />
        </Field>

        {provider !== 'SANDBOX' && (
          <Field label="Phone number" hint="The WhatsApp number this channel sends from.">
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+14155238886" />
          </Field>
        )}

        <Field label="Answering flow" hint="Leave blank to use the workspace default.">
          <Select value={flowId} onChange={(e) => setFlowId(e.target.value)}>
            <option value="">Workspace default</option>
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name}
              </option>
            ))}
          </Select>
        </Field>

        {info?.fields.map((field) => (
          <Field key={field.key} label={field.label} hint={field.help} required={field.required}>
            <Input
              type={field.secret ? 'password' : 'text'}
              value={credentials[field.key] ?? ''}
              onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
              autoComplete="off"
            />
          </Field>
        ))}

        {provider !== 'SANDBOX' && (
          <div className="rounded-xl border border-electric-400/20 bg-electric-400/[0.06] px-4 py-3">
            <p className="text-[12.5px] leading-relaxed text-electric-200/90">
              After connecting, copy the webhook URL from the channel card into your provider console. Axon will
              reject any inbound request whose signature does not match.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditModal({
  channel,
  providers,
  flows,
  onClose,
  onSaved,
}: {
  channel: Channel | null;
  providers: ProviderInfo[];
  flows: Flow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!channel) return;
    setCredentials({});
    setName(channel.name);
    setPhoneNumber(channel.phoneNumber ?? '');
  }, [channel]);

  if (!channel) return null;
  const info = providers.find((p) => p.provider === channel.provider);

  const save = async () => {
    setBusy(true);
    try {
      // Only send fields that were actually filled in - the server merges them
      // with what is already stored, so blanks never wipe a working secret.
      const filled = Object.fromEntries(Object.entries(credentials).filter(([, v]) => v.trim()));
      await patch(`/channels/${channel.id}`, {
        name,
        phoneNumber: phoneNumber || undefined,
        ...(Object.keys(filled).length ? { credentials: filled } : {}),
      });
      toast.success('Channel updated');
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    try {
      await post(`/channels/${channel.id}/rotate-webhook`, {});
      toast.success('New webhook URL issued - update it in your provider console');
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not rotate');
    }
  };

  return (
    <Modal
      open={!!channel}
      onClose={onClose}
      title={`Edit ${channel.name}`}
      description="Leave a credential blank to keep the stored value."
      footer={
        <>
          <Button variant="ghost" onClick={rotate}>
            Rotate webhook
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Channel name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone number">
          <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        </Field>

        {info?.fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            hint={
              channel.configuredFields.includes(field.key)
                ? 'Currently set - enter a new value to replace it.'
                : field.help
            }
          >
            <Input
              type={field.secret ? 'password' : 'text'}
              value={credentials[field.key] ?? ''}
              onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={channel.configuredFields.includes(field.key) ? '••••••••' : ''}
              autoComplete="off"
            />
          </Field>
        ))}
      </div>
    </Modal>
  );
}
