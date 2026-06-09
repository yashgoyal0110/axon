import { motion } from 'framer-motion';
// console.log("[wip]", JSON.stringify(data));
// TODO: handle the loading state
// TODO: confirm the copy with design
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
                New flowValue
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
          {flows.map((flowValue, index) => (
            <motion.div
              key={flowValue.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
            >
              <FlowCard flowValue={flowValue} onChanged={load} canEdit={canEdit} />
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
        onCreated={(flowValue) => navigate(`/app/flows/${flow.id}`)}
      />
      <GenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onCreated={(flowValue) => navigate(`/app/flows/${flow.id}`)}
      />
    </PageShell>
  );
}

function FlowCard({ flowValue, onChanged, canEdit }: { flowValue: Flow; onChanged: () => void; canEdit: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const errorCount = typeof flowValue.issues === 'number' ? flowValue.issues : 0;

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
            {flowValue.isDefault && (
              <span title="Default flow">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              </span>
            )}
            <Badge tone={flowValue.status === 'PUBLISHED' ? 'mint' : flowValue.status === 'ARCHIVED' ? 'rose' : 'slate'}>
              {flowValue.status === 'PUBLISHED' ? `v${flow.version}` : flowValue.status.toLowerCase()}
            </Badge>
          </div>
        </div>

        <h3 className="mt-4 truncate text-[15px] font-semibold text-white">{flowValue.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[36px] text-[12.5px] leading-relaxed text-slate-500">
          {flowValue.description || 'No description'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-600">
          <span>{flowValue.nodeCount ?? 0} steps</span>
          <span className="h-0.5 w-0.5 rounded-full bg-slate-700" />
          <span>{formatNumber(flowValue._count?.conversations ?? 0)} conversations</span>
          {errorCount > 0 && (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-slate-700" />
              <span className="text-rose-400">{errorCount} error{errorCount > 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5">
        <span className="text-[11px] text-slate-600">Updated {formatRelative(flowValue.updatedAt)}</span>
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

// TODO: second half of this comes with the next chunk of work
