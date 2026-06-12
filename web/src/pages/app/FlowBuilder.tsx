import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Flag,
  History,
  PlayCircle,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Split,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import toast from 'react-hot-toast';
import { Badge, Button, Field, Input, Modal, Spinner, Textarea, Toggle } from '@/components/ui';
import { Inspector } from '@/components/flow/Inspector';
import { nodeTypes } from '@/components/flow/nodes';
import { ApiError, del, get, patch, post } from '@/lib/api';
import { useCan } from '@/lib/store';
import type { Flow, FlowNodeData, FlowNodeKind, GraphIssue } from '@/lib/types';
import { cn, formatRelative } from '@/lib/utils';

const PALETTE: Array<{ kind: FlowNodeKind; icon: typeof Radio; label: string; hint: string }> = [
  { kind: 'message', icon: Radio, label: 'Message', hint: 'Send text, keep going' },
  { kind: 'question', icon: Bot, label: 'Question', hint: 'Ask with quick replies' },
  { kind: 'capture', icon: Save, label: 'Capture', hint: 'Store a free-text answer' },
  { kind: 'ai', icon: Sparkles, label: 'AI', hint: 'Let Gemini answer' },
  { kind: 'condition', icon: Split, label: 'Condition', hint: 'Branch on a variable' },
  { kind: 'handoff', icon: UserCheck, label: 'Handoff', hint: 'Pass to a human' },
  { kind: 'end', icon: Flag, label: 'End', hint: 'Close the conversation' },
];

export default function FlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  );
}

function FlowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canEdit = useCan('AGENT');
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issues, setIssues] = useState<GraphIssue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const nodeCounter = useRef(0);

  // -- load -----------------------------------------------------------------

  useEffect(() => {
    if (!id) return;
    void get<Flow & { issues: GraphIssue[] }>(`/flows/${id}`)
      .then((data) => {
        setFlow(data);
        const graph = data.graph as { nodes: Node<FlowNodeData>[]; edges: Edge[] };
        setNodes(graph.nodes ?? []);
        setEdges(graph.edges ?? []);
        setIssues(data.issues ?? []);
        // Keep generated ids from colliding with whatever is already there.
        nodeCounter.current = (graph.nodes ?? []).length + 1;
        setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 60);
      })
      .catch(() => {
        toast.error('That flow could not be loaded');
        navigate('/app/flows');
      });
  }, [id, navigate, fitView]);

  // -- graph mutations -------------------------------------------------------

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current) as Node<FlowNodeData>[]);
      // Selection and dimension changes are not user edits worth saving.
      if (changes.some((c) => c.type === 'position' || c.type === 'remove' || c.type === 'add')) setDirty(true);
    },
    [],
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) setDirty(true);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        // One outgoing edge per handle - reconnecting replaces the old target.
        const filtered = current.filter(
          (edge) => !(edge.source === connection.source && edge.sourceHandle === connection.sourceHandle),
        );
        return addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.sourceHandle ?? 'out'}-${connection.target}`,
            animated: true,
          },
          filtered,
        );
      });
      setDirty(true);
    },
    [],
  );

  const addNode = useCallback(
    (kind: FlowNodeKind) => {
      const id = `n${nodeCounter.current++}`;
      // Drop new nodes near the middle of whatever the user is looking at.
      const position = screenToFlowPosition({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
        y: window.innerHeight / 2 + (Math.random() - 0.5) * 120,
      });

      const defaults: Record<string, Partial<FlowNodeData>> = {
        message: { text: 'Hi there! 👋' },
        question: { text: 'What can I help you with?', responses: ['Option A', 'Option B'] },
        capture: { text: 'What is your email?', variable: 'email' },
        ai: { aiPrompt: 'Answer the customer helpfully in under 50 words.' },
        condition: { conditions: [{ variable: '', operator: 'equals', value: '', label: 'Rule 1' }] },
        handoff: { text: 'Connecting you with a teammate now.' },
        end: { text: 'Thanks for chatting - talk soon!' },
      };

      const node: Node<FlowNodeData> = {
        id,
        type: kind,
        position,
        data: { label: PALETTE.find((p) => p.kind === kind)?.label ?? kind, ...defaults[kind] },
      };

      setNodes((current) => [...current, node]);
      setSelectedId(id);
      setDirty(true);
    },
    [screenToFlowPosition],
  );

  const updateNode = useCallback((nodeId: string, changes: Partial<FlowNodeData>) => {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...changes } } : node)),
    );
    setDirty(true);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedId(null);
    setDirty(true);
  }, []);

  // -- persistence -----------------------------------------------------------

  const save = useCallback(async () => {
    if (!id || !canEdit) return;
    setSaving(true);
    try {
      await patch(`/flows/${id}`, { graph: { nodes, edges } });
      const validation = await post<{ issues: GraphIssue[] }>('/flows/validate', { graph: { nodes, edges } });
      setIssues(validation.issues);
      setDirty(false);
      toast.success('Saved');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }, [id, nodes, edges, canEdit]);

  // Cmd/Ctrl+S saves, matching every other editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // Warn before losing unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const publish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      if (dirty) await patch(`/flows/${id}`, { graph: { nodes, edges } });
      const result = await post<Flow & { warnings: GraphIssue[] }>(`/flows/${id}/publish`, {});
      setFlow((prev) => (prev ? { ...prev, ...result } : prev));
      setDirty(false);
      toast.success(`Published v${result.version}`);
      if (result.warnings?.length) {
        setIssues(result.warnings);
        toast(`${result.warnings.length} warning(s) - worth a look`, { icon: '⚠️' });
      }
    } catch (error) {
      if (error instanceof ApiError && error.body?.issues) {
        setIssues(error.body.issues as GraphIssue[]);
        setShowIssues(true);
        toast.error('Fix the highlighted problems first');
      } else {
        toast.error(error instanceof ApiError ? error.message : 'Could not publish');
      }
    } finally {
      setPublishing(false);
    }
  };

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warningCount = issues.filter((i) => i.level === 'warning').length;

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: true,
        labelStyle: { fill: '#94a3b8', fontSize: 10 },
        labelBgStyle: { fill: '#0a0f1e' },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [edges],
  );

  if (!flow) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-ink-950/70 px-4 backdrop-blur-xl">
        <Link
          to="/app/flows"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[14px] font-semibold text-white">{flow.name}</h1>
            <Badge tone={flow.status === 'PUBLISHED' ? 'mint' : 'slate'}>
              {flow.status === 'PUBLISHED' ? `v${flow.version} live` : 'draft'}
            </Badge>
            {dirty && <Badge tone="amber">unsaved</Badge>}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {(errorCount > 0 || warningCount > 0) && (
            <button
              onClick={() => setShowIssues(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                errorCount > 0
                  ? 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15',
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
            </button>
          )}

          <Button variant="ghost" size="sm" icon={History} onClick={() => setShowVersions(true)}>
            <span className="hidden sm:inline">Versions</span>
          </Button>
          <Button variant="ghost" size="sm" icon={PlayCircle} onClick={() => setShowPreview(true)}>
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button variant="secondary" size="sm" icon={Wand2} onClick={() => setShowSettings(true)}>
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button variant="secondary" size="sm" icon={Save} loading={saving} onClick={save} disabled={!canEdit || !dirty}>
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button size="sm" icon={Send} loading={publishing} onClick={publish} disabled={!canEdit}>
            Publish
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Palette */}
        <div className="hidden w-[190px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/40 p-3 md:flex">
          <p className="mb-2 px-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-600">Add a step</p>
          <div className="space-y-1">
            {PALETTE.map((item) => (
              <button
                key={item.kind}
                onClick={() => addNode(item.kind)}
                disabled={!canEdit}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 text-left transition-all hover:border-mint-400/25 hover:bg-mint-400/[0.06] disabled:opacity-40"
              >
                <item.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-mint-300" />
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium text-slate-300">{item.label}</span>
                  <span className="block text-[10px] leading-tight text-slate-600">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] font-medium text-slate-400">Tip</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600">
              Drag from a node's right edge onto another node to connect them. Questions have one handle per reply
              option.
            </p>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.2}
            maxZoom={1.8}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable
            deleteKeyCode={canEdit ? ['Backspace', 'Delete'] : null}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(148,163,184,0.14)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={() => '#1d2842'}
              nodeStrokeColor={() => 'rgba(77,251,177,0.5)'}
              maskColor="rgba(4,6,13,0.75)"
            />
          </ReactFlow>

          {/* Mobile palette */}
          <div className="scrollbar-none absolute inset-x-0 bottom-0 flex gap-1.5 overflow-x-auto border-t border-white/[0.06] bg-ink-950/85 p-2 backdrop-blur-xl md:hidden">
            {PALETTE.map((item) => (
              <button
                key={item.kind}
                onClick={() => addNode(item.kind)}
                disabled={!canEdit}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] font-medium text-slate-300"
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>

          <Inspector
            node={selected}
            onChange={updateNode}
            onDelete={deleteNode}
            onClose={() => setSelectedId(null)}
            readOnly={!canEdit}
          />
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        flow={flow}
        onSaved={(updated) => setFlow(updated)}
        readOnly={!canEdit}
      />
      <VersionsModal open={showVersions} onClose={() => setShowVersions(false)} flowId={flow.id} />
      <PreviewModal open={showPreview} onClose={() => setShowPreview(false)} flowId={flow.id} flowName={flow.name} />
      <IssuesModal
        open={showIssues}
        onClose={() => setShowIssues(false)}
        issues={issues}
        onSelect={(nodeId) => {
          setSelectedId(nodeId);
          setShowIssues(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SettingsModal({
  open,
  onClose,
  flow,
  onSaved,
  readOnly,
}: {
  open: boolean;
  onClose: () => void;
  flow: Flow;
  onSaved: (flow: Flow) => void;
  readOnly: boolean;
}) {
  const [form, setForm] = useState({
    name: flow.name,
    description: flow.description ?? '',
    aiEnabled: flow.aiEnabled,
    aiPersona: flow.aiPersona ?? '',
    fallbackMessage: flow.fallbackMessage,
    triggerKeywords: flow.triggerKeywords.join(', '),
    isDefault: flow.isDefault,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: flow.name,
      description: flow.description ?? '',
      aiEnabled: flow.aiEnabled,
      aiPersona: flow.aiPersona ?? '',
      fallbackMessage: flow.fallbackMessage,
      triggerKeywords: flow.triggerKeywords.join(', '),
      isDefault: flow.isDefault,
    });
  }, [open, flow]);

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await patch<Flow>(`/flows/${flow.id}`, {
        name: form.name,
        description: form.description || undefined,
        aiEnabled: form.aiEnabled,
        aiPersona: form.aiPersona || undefined,
        fallbackMessage: form.fallbackMessage,
        triggerKeywords: form.triggerKeywords.split(',').map((s) => s.trim()).filter(Boolean),
        isDefault: form.isDefault,
      });
      onSaved({ ...flow, ...updated });
      toast.success('Settings saved');
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Flow settings"
      description="How this flow behaves at runtime."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={readOnly}>
            Save settings
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={readOnly} />
        </Field>

        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={readOnly}
          />
        </Field>

        <Field label="Trigger keywords" hint="Comma separated. Used to route contacts into this flow.">
          <Input
            value={form.triggerKeywords}
            onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })}
            placeholder="hi, hello, support"
            disabled={readOnly}
          />
        </Field>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <Toggle
            checked={form.aiEnabled}
            onChange={(value) => setForm({ ...form, aiEnabled: value })}
            label="Let AI handle unmatched replies"
            description="When a contact says something your flow did not anticipate, Gemini answers in context and the flow re-asks."
            disabled={readOnly}
          />
        </div>

        <Field label="AI persona" hint="The system instruction that shapes tone and boundaries.">
          <Textarea
            rows={3}
            value={form.aiPersona}
            onChange={(e) => setForm({ ...form, aiPersona: e.target.value })}
            placeholder="You are a warm, concise support agent for Acme. Never invent prices."
            disabled={readOnly || !form.aiEnabled}
          />
        </Field>

        <Field label="Fallback message" hint="Sent when AI is unavailable or out of quota.">
          <Input
            value={form.fallbackMessage}
            onChange={(e) => setForm({ ...form, fallbackMessage: e.target.value })}
            disabled={readOnly}
          />
        </Field>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <Toggle
            checked={form.isDefault}
            onChange={(value) => setForm({ ...form, isDefault: value })}
            label="Default flow for this workspace"
            description="Used by any channel that has not been assigned a specific flow."
            disabled={readOnly}
          />
        </div>
      </div>
    </Modal>
  );
}

function VersionsModal({ open, onClose, flowId }: { open: boolean; onClose: () => void; flowId: string }) {
  const [versions, setVersions] = useState<Array<{ id: string; version: number; notes: string | null; createdAt: string }> | null>(null);
  const canRestore = useCan('ADMIN');

  useEffect(() => {
    if (!open) return;
    setVersions(null);
    void get<typeof versions>(`/flows/${flowId}/versions`).then(setVersions).catch(() => setVersions([]));
  }, [open, flowId]);

  const restore = async (version: number) => {
    try {
      await post(`/flows/${flowId}/versions/${version}/restore`, {});
      toast.success(`Restored v${version} into the draft`);
      onClose();
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not restore');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Version history" description="Every publish creates an immutable snapshot.">
      {!versions ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : versions.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-slate-500">
          Nothing published yet. Hit Publish to create the first version.
        </p>
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint-400/10 font-mono text-[11px] font-bold text-mint-300">
                v{version.version}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-slate-200">{version.notes || 'No notes'}</p>
                <p className="text-[11.5px] text-slate-600">{formatRelative(version.createdAt)}</p>
              </div>
              {canRestore && (
                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => restore(version.version)}>
                  Restore
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PreviewModal({
  open,
  onClose,
  flowId,
  flowName,
}: {
  open: boolean;
  onClose: () => void;
  flowId: string;
  flowName: string;
}) {
  const [history, setHistory] = useState<Array<{ role: 'user' | 'bot'; text: string; buttons?: string[] }>>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setHistory([]);
      setInput('');
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const outgoing = [...history, { role: 'user' as const, text }];
    setHistory(outgoing);
    setInput('');

    try {
      const result = await post<{ replies: Array<{ text: string; buttons?: string[] }> }>(
        `/flows/${flowId}/preview`,
        { history, message: text },
      );
      setHistory([...outgoing, ...result.replies.map((r) => ({ role: 'bot' as const, ...r }))]);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Preview"
      description={`A dry run of "${flowName}" - nothing is stored and no provider is contacted.`}
      size="md"
    >
      <div className="flex h-[420px] flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b141a]">
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
          {history.length === 0 && (
            <p className="py-10 text-center text-[12.5px] text-slate-600">
              Send a message to walk the flow from its Start node.
            </p>
          )}
          {history.map((turn, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug',
                  turn.role === 'user' ? 'rounded-tr-sm bg-[#005c4b] text-slate-100' : 'rounded-tl-sm bg-[#202c33] text-slate-200',
                )}
              >
                <p className="whitespace-pre-wrap">{turn.text}</p>
                {turn.buttons && (
                  <div className="mt-1.5 space-y-1 border-t border-white/[0.08] pt-1.5">
                    {turn.buttons.map((button) => (
                      <button
                        key={button}
                        onClick={() => send(button)}
                        className="block w-full rounded bg-white/[0.05] px-2 py-1 text-center text-[11.5px] font-medium text-[#53bdeb] hover:bg-white/[0.09]"
                      >
                        {button}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2 border-t border-white/[0.07] bg-[#202c33] p-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-full bg-[#2a3942] px-3.5 py-2 text-[12.5px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-500 text-ink-950 disabled:opacity-40"
          >
            {busy ? <Spinner className="h-3.5 w-3.5 text-ink-950" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </form>
      </div>
    </Modal>
  );
}

function IssuesModal({
  open,
  onClose,
  issues,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  issues: GraphIssue[];
  onSelect: (nodeId: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Flow checks" description="Errors block publishing. Warnings are worth a look.">
      {issues.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <CheckCircle2 className="mb-3 h-8 w-8 text-mint-400" />
          <p className="text-[13.5px] text-slate-400">Everything checks out.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, index) => (
            <button
              key={index}
              onClick={() => issue.nodeId && onSelect(issue.nodeId)}
              disabled={!issue.nodeId}
              className={cn(
                'flex w-full gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                issue.level === 'error'
                  ? 'border-rose-500/20 bg-rose-500/[0.07] hover:bg-rose-500/[0.12]'
                  : 'border-amber-500/20 bg-amber-500/[0.07] hover:bg-amber-500/[0.12]',
                !issue.nodeId && 'cursor-default',
              )}
            >
              <AlertTriangle
                className={cn('mt-0.5 h-4 w-4 shrink-0', issue.level === 'error' ? 'text-rose-400' : 'text-amber-400')}
              />
              <span className="text-[13px] leading-relaxed text-slate-300">{issue.message}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
