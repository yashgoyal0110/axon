import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  Bot,
  Flag,
  PlayCircle,
  Radio,
  Save,
  Sparkles,
  Split,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { FlowNodeData, FlowNodeKind } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NodeStyle {
  icon: LucideIcon;
  label: string;
  border: string;
  glow: string;
  chip: string;
}

export const NODE_STYLES: Record<FlowNodeKind, NodeStyle> = {
  start: {
    icon: PlayCircle,
    label: 'Start',
    border: 'border-mint-400/40',
    glow: 'shadow-[0_0_32px_-12px_rgba(0,212,127,0.8)]',
    chip: 'bg-mint-400/12 text-mint-300',
  },
  message: {
    icon: Radio,
    label: 'Message',
    border: 'border-electric-400/35',
    glow: 'shadow-[0_0_32px_-14px_rgba(14,165,233,0.8)]',
    chip: 'bg-electric-400/12 text-electric-300',
  },
  question: {
    icon: Bot,
    label: 'Question',
    border: 'border-electric-400/35',
    glow: 'shadow-[0_0_32px_-14px_rgba(14,165,233,0.8)]',
    chip: 'bg-electric-400/12 text-electric-300',
  },
  capture: {
    icon: Save,
    label: 'Capture',
    border: 'border-amber-400/35',
    glow: 'shadow-[0_0_32px_-14px_rgba(245,158,11,0.8)]',
    chip: 'bg-amber-400/12 text-amber-300',
  },
  ai: {
    icon: Sparkles,
    label: 'AI',
    border: 'border-violet-400/40',
    glow: 'shadow-[0_0_32px_-12px_rgba(139,92,246,0.85)]',
    chip: 'bg-violet-400/12 text-violet-300',
  },
  condition: {
    icon: Split,
    label: 'Condition',
    border: 'border-amber-400/35',
    glow: 'shadow-[0_0_32px_-14px_rgba(245,158,11,0.8)]',
    chip: 'bg-amber-400/12 text-amber-300',
  },
  handoff: {
    icon: UserCheck,
    label: 'Handoff',
    border: 'border-rose-400/35',
    glow: 'shadow-[0_0_32px_-14px_rgba(244,63,94,0.8)]',
    chip: 'bg-rose-400/12 text-rose-300',
  },
  end: {
    icon: Flag,
    label: 'End',
    border: 'border-rose-400/35',
    glow: 'shadow-[0_0_32px_-14px_rgba(244,63,94,0.8)]',
    chip: 'bg-rose-400/12 text-rose-300',
  },
};

/**
 * One component renders every node type - the shell is identical and the body
 * varies by kind, which keeps handle positioning consistent across the graph.
 */
function FlowNodeComponent({ id, type, data, selected }: NodeProps<FlowNodeData>) {
  const kind = (type ?? 'message') as FlowNodeKind;
  const style = NODE_STYLES[kind] ?? NODE_STYLES.message;
  const Icon = style.icon;

  const isStart = kind === 'start';
  const isTerminal = kind === 'end' || kind === 'handoff';
  const responses = data.responses ?? [];
  const conditions = data.conditions ?? [];

  return (
    <div
      className={cn(
        'w-[228px] rounded-xl border bg-ink-850/95 backdrop-blur-sm transition-all duration-200',
        style.border,
        selected ? cn('ring-2 ring-mint-400/60', style.glow) : 'shadow-lg',
      )}
    >
      {!isStart && <Handle type="target" position={Position.Left} className="!-left-1.5" />}

      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <span className={cn('flex h-5 w-5 items-center justify-center rounded-md', style.chip)}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="flex-1 truncate text-[11.5px] font-semibold text-slate-200">{data.label || style.label}</span>
        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', style.chip)}>
          {style.label}
        </span>
      </div>

      <div className="px-3 py-2.5">
        {isStart ? (
          <div>
            <p className="text-[10.5px] text-slate-500">Conversation entry point</p>
            {!!data.triggers?.length && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {data.triggers.slice(0, 4).map((trigger) => (
                  <span
                    key={trigger}
                    className="rounded border border-white/[0.07] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
                  >
                    {trigger}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : kind === 'ai' ? (
          <p className="line-clamp-3 text-[11px] leading-relaxed text-slate-400">
            {data.aiPrompt || 'Answers with AI using the conversation history.'}
          </p>
        ) : kind === 'condition' ? (
          <div className="space-y-1">
            {conditions.length === 0 ? (
              <p className="text-[10.5px] italic text-slate-600">No rules yet</p>
            ) : (
              conditions.slice(0, 3).map((rule, index) => (
                <div key={index} className="relative rounded border border-white/[0.07] bg-white/[0.03] px-2 py-1">
                  <span className="font-mono text-[9.5px] text-slate-400">
                    {rule.variable} {rule.operator.replace(/_/g, ' ')} {rule.value}
                  </span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`condition-${index}`}
                    className="!-right-[18px]"
                    style={{ top: '50%' }}
                  />
                </div>
              ))
            )}
            <div className="relative rounded border border-dashed border-white/[0.09] px-2 py-1">
              <span className="text-[9.5px] text-slate-600">otherwise</span>
              <Handle
                type="source"
                position={Position.Right}
                id="condition-else"
                className="!-right-[18px]"
                style={{ top: '50%' }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
              {data.text || <span className="italic text-slate-600">No message text yet</span>}
            </p>

            {kind === 'capture' && data.variable && (
              <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-400/10 px-1.5 py-0.5">
                <span className="font-mono text-[9.5px] text-amber-300">→ {data.variable}</span>
              </div>
            )}

            {kind === 'question' && (
              <div className="mt-2 space-y-1">
                {responses.length === 0 ? (
                  <p className="text-[10px] italic text-slate-600">No reply options</p>
                ) : (
                  responses.map((response, index) => (
                    <div
                      key={index}
                      className="relative rounded border border-white/[0.07] bg-white/[0.04] px-2 py-1 text-[10px] text-slate-300"
                    >
                      <span className="truncate">{response}</span>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`response-${index}`}
                        className="!-right-[18px]"
                        style={{ top: '50%' }}
                      />
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* A single outgoing handle for node kinds that do not fan out. */}
      {!isTerminal && kind !== 'question' && kind !== 'condition' && (
        <Handle type="source" position={Position.Right} className="!-right-1.5" />
      )}
    </div>
  );
}

export const FlowNode = memo(FlowNodeComponent);

export const nodeTypes = {
  start: FlowNode,
  message: FlowNode,
  question: FlowNode,
  capture: FlowNode,
  ai: FlowNode,
  condition: FlowNode,
  handoff: FlowNode,
  end: FlowNode,
};


// kept around until the new implementation is verified
const nodeTypesLegacy = {
  start: FlowNode,
  message: FlowNode,
  question: FlowNode,
  capture: FlowNode,
  ai: FlowNode,
  condition: FlowNode,
  handoff: FlowNode,
  end: FlowNode,
};