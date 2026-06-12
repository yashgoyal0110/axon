import { motion } from 'framer-motion';
import {
  Archive,
  Copy,
  Layers,
  MoreVertical,
  Plus,
  Sparkles,
  Star,
  Wand2,
  Workflow,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Skeleton, Textarea } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { ApiError, del, get, post } from '@/lib/api';
import { useCan } from '@/lib/store';
import type { Flow, FlowTemplate } from '@/lib/types';
import { cn, formatNumber, formatRelative } from '@/lib/utils';

export default function Flows() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canEdit = useCan('AGENT');

  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = () => get<Flow[]>('/flows').then(setFlows).catch(() => setFlows([]));

  useEffect(() => {
    void load();
  }, []);

  // Arriving from the marketing site with ?template=… opens the picker primed.
  useEffect(() => {
    if (params.get('template')) setShowCreate(true);
  }, [params]);

  return (
    <PageShell>
      <PageHeader
        title="Flows"
        description="Each flow is a conversation your bot can run. Publish creates an immutable version."
        actions={
          canEdit && (
            <>
              <Button variant="secondary" icon={Wand2} onClick={() => setShowGenerate(true)}>
                Generate with AI
              </Button>
              <Button icon={Plus} onClick={() => setShowCreate(true)}>
                New flow
              </Button>
            </>
          )
        }
      />

      {!flows ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <Card className="py-4">
          <EmptyState
            icon={Workflow}
            title="No flows yet"
            description="Start from a template, or describe your business and let AI draft the whole conversation."
            action={
              canEdit && (
                <div className="flex gap-2">
                  <Button icon={Plus} onClick={() => setShowCreate(true)}>
                    From a template
                  </Button>
                  <Button variant="secondary" icon={Wand2} onClick={() => setShowGenerate(true)}>
                    Generate with AI
                  </Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow, index) => (
            <motion.div
              key={flow.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
            >
              <FlowCard flow={flow} onChanged={load} canEdit={canEdit} />
            </motion.div>
          ))}
        </div>
      )}

      <CreateModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          if (params.get('template')) setParams({});
        }}
        presetTemplate={params.get('template')}
        onCreated={(flow) => navigate(`/app/flows/${flow.id}`)}
      />
      <GenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onCreated={(flow) => navigate(`/app/flows/${flow.id}`)}
      />
    </PageShell>
  );
}

function FlowCard({ flow, onChanged, canEdit }: { flow: Flow; onChanged: () => void; canEdit: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const errorCount = typeof flow.issues === 'number' ? flow.issues : 0;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const duplicate = async () => {
    try {
      await post(`/flows/${flow.id}/duplicate`, {});
      toast.success('Flow duplicated');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not duplicate');
    }
    setMenuOpen(false);
  };

  const archive = async () => {
    try {
      await del(`/flows/${flow.id}`);
      toast.success('Flow archived');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not archive');
    }
    setMenuOpen(false);
  };

  return (
    <Card hover className="group h-full">
      <Link to={`/app/flows/${flow.id}`} className="block p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-mint-400/20 bg-mint-400/[0.08]">
            <Workflow className="h-4 w-4 text-mint-300" />
          </div>
          <div className="flex items-center gap-1.5">
            {flow.isDefault && (
              <span title="Default flow">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              </span>
            )}
            <Badge tone={flow.status === 'PUBLISHED' ? 'mint' : flow.status === 'ARCHIVED' ? 'rose' : 'slate'}>
              {flow.status === 'PUBLISHED' ? `v${flow.version}` : flow.status.toLowerCase()}
            </Badge>
          </div>
        </div>

        <h3 className="mt-4 truncate text-[15px] font-semibold text-white">{flow.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[36px] text-[12.5px] leading-relaxed text-slate-500">
          {flow.description || 'No description'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-600">
          <span>{flow.nodeCount ?? 0} steps</span>
          <span className="h-0.5 w-0.5 rounded-full bg-slate-700" />
          <span>{formatNumber(flow._count?.conversations ?? 0)} conversations</span>
          {errorCount > 0 && (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-slate-700" />
              <span className="text-rose-400">{errorCount} error{errorCount > 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5">
        <span className="text-[11px] text-slate-600">Updated {formatRelative(flow.updatedAt)}</span>
        {canEdit && (
          <div ref={ref} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute bottom-full right-0 z-20 mb-1 w-40 overflow-hidden rounded-xl border border-white/10 bg-ink-850/95 p-1 shadow-lift backdrop-blur-2xl"
              >
                <button
                  onClick={duplicate}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-slate-300 hover:bg-white/[0.06]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <button
                  onClick={archive}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-rose-300 hover:bg-rose-500/10"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function CreateModal({
  open,
  onClose,
  onCreated,
  presetTemplate,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (flow: Flow) => void;
  presetTemplate?: string | null;
}) {
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(presetTemplate ?? null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(presetTemplate ?? null);
    void get<FlowTemplate[]>('/flows/templates', { auth: false }).then((list) => {
      setTemplates(list);
      if (presetTemplate) {
        const match = list.find((t) => t.key === presetTemplate);
        if (match) setName(match.name);
      }
    });
  }, [open, presetTemplate]);

  const create = async () => {
    setCreating(true);
    try {
      const flow = await post<Flow>('/flows', {
        name: name.trim() || templates?.find((t) => t.key === selected)?.name || 'Untitled flow',
        templateKey: selected ?? undefined,
      });
      toast.success('Flow created');
      onCreated(flow);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the flow');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New flow"
      description="Start blank or from a template you can edit freely."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} loading={creating}>
            Create flow
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Flow name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead qualification" />
        </Field>

        <div>
          <p className="mb-2.5 text-[13px] font-medium text-slate-300">Starting point</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setSelected(null)}
              className={cn(
                'rounded-xl border p-3.5 text-left transition-colors',
                selected === null
                  ? 'border-mint-400/40 bg-mint-400/[0.08]'
                  : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
              )}
            >
              <Plus className="h-4 w-4 text-mint-300" />
              <p className="mt-2 text-[13px] font-semibold text-white">Blank canvas</p>
              <p className="mt-0.5 text-[11.5px] text-slate-500">Just a Start node.</p>
            </button>

            {(templates ?? []).map((template) => (
              <button
                key={template.key}
                onClick={() => {
                  setSelected(template.key);
                  if (!name.trim()) setName(template.name);
                }}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition-colors',
                  selected === template.key
                    ? 'border-mint-400/40 bg-mint-400/[0.08]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
                )}
              >
                <Layers className="h-4 w-4" style={{ color: template.accent }} />
                <p className="mt-2 text-[13px] font-semibold text-white">{template.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">
                  {template.description}
                </p>
                <p className="mt-1.5 text-[10.5px] text-slate-600">{template.nodeCount} steps</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function GenerateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (flow: Flow) => void;
}) {
  const [form, setForm] = useState({ businessName: '', businessDescription: '', goal: '' });
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const result = await post<{ graph: unknown; aiPersona: string }>('/flows/generate', form);
      const flow = await post<Flow>('/flows', {
        name: `${form.businessName} assistant`,
        description: form.businessDescription.slice(0, 200),
        graph: result.graph,
      });
      // Persona comes back separately from the graph, so apply it after create.
      await import('@/lib/api').then(({ patch }) =>
        patch(`/flows/${flow.id}`, { aiPersona: result.aiPersona }),
      );
      toast.success('Flow generated');
      onCreated(flow);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate a flow with AI"
      description="Describe the business and Gemini drafts the conversation, laid out and ready to edit."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={Sparkles}
            onClick={generate}
            loading={busy}
            disabled={!form.businessName.trim() || !form.businessDescription.trim()}
          >
            Generate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Business name" required>
          <Input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            placeholder="Brew & Bean"
          />
        </Field>

        <Field label="What do they do?" required hint="The more specific, the better the flow.">
          <Textarea
            rows={3}
            value={form.businessDescription}
            onChange={(e) => setForm({ ...form, businessDescription: e.target.value })}
            placeholder="A speciality coffee roastery in Mumbai taking bean orders and table bookings over WhatsApp."
          />
        </Field>

        <Field label="Goal of the conversation" hint="Optional - what should the bot achieve?">
          <Input
            value={form.goal}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
            placeholder="Take an order and capture a delivery address"
          />
        </Field>

        <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-violet-200/90">
            Requires <code className="font-mono text-[11.5px]">GEMINI_API_KEY</code> on the server. Without it, start
            from a template instead - everything else works the same.
          </p>
        </div>
      </div>
    </Modal>
  );
}
