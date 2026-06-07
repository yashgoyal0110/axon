import { motion } from 'framer-motion';
import { Bot, GitBranch, MessageSquare, PlayCircle, Save, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewNode {
  id: string;
  x: number;
  y: number;
  title: string;
  kind: 'start' | 'question' | 'ai' | 'branch' | 'end';
  options?: string[];
}

const NODES: PreviewNode[] = [
  { id: 'a', x: 22, y: 120, title: 'Start', kind: 'start' },
  { id: 'b', x: 148, y: 60, title: 'What can I help with?', kind: 'question', options: ['Order', 'Support'] },
  { id: 'c', x: 148, y: 208, title: 'AI answers freeform', kind: 'ai' },
  { id: 'd', x: 320, y: 44, title: 'Budget range?', kind: 'question', options: ['< $2k', '> $10k'] },
  { id: 'e', x: 320, y: 200, title: 'Route by value', kind: 'branch' },
  { id: 'f', x: 478, y: 128, title: 'Book a call', kind: 'end' },
];

const EDGES: Array<[string, string]> = [
  ['a', 'b'],
  ['a', 'c'],
  ['b', 'd'],
  ['c', 'e'],
  ['d', 'f'],
  ['e', 'f'],
];

const KIND_STYLE: Record<PreviewNode['kind'], { ring: string; icon: typeof Bot; tint: string }> = {
  start: { ring: 'border-mint-400/40', icon: PlayCircle, tint: 'text-mint-300' },
  question: { ring: 'border-electric-400/35', icon: MessageSquare, tint: 'text-electric-300' },
  ai: { ring: 'border-violet-400/40', icon: Sparkles, tint: 'text-violet-300' },
  branch: { ring: 'border-amber-400/35', icon: GitBranch, tint: 'text-amber-300' },
  end: { ring: 'border-rose-400/35', icon: Bot, tint: 'text-rose-300' },
};

const NODE_W = 128;
const NODE_H = 56;

/**
 * A faux builder canvas for the landing page: static nodes, animated dashed
 * edges, and a pulse travelling along each connection.
 */
export function FlowCanvasPreview({ className }: { className?: string }) {
  const center = (id: string) => {
    const node = NODES.find((n) => n.id === id)!;
    return { x: node.x + NODE_W, y: node.y + NODE_H / 2 };
  };
  const entry = (id: string) => {
    const node = NODES.find((n) => n.id === id)!;
    return { x: node.x, y: node.y + NODE_H / 2 };
  };

  const path = (from: string, to: string) => {
    const s = center(from);
    const t = entry(to);
    const dx = Math.max(40, (t.x - s.x) * 0.55);
    return `M ${s.x},${s.y} C ${s.x + dx},${s.y} ${t.x - dx},${t.y} ${t.x},${t.y}`;
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900/70 shadow-lift backdrop-blur-xl',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-ink-850/70 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-mint-500/70" />
        </div>
        <span className="ml-2 font-mono text-[11px] text-slate-500">lead-qualification.flow</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-md border border-mint-400/20 bg-mint-400/10 px-2 py-0.5 text-[10px] font-semibold text-mint-300 sm:inline-flex">
            <Save className="h-2.5 w-2.5" />
            Saved
          </span>
          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            v4
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative h-[330px] w-full"
        styleValue={{
          backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.13) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 330" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="edge-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4dfbb1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {EDGES.map(([from, to], index) => {
            const d = path(from, to);
            return (
              <g key={`${from}-${to}`}>
                <path d={d} fill="none" stroke="url(#edge-grad)" strokeWidth="1.6" />
                <path
                  d={d}
                  fill="none"
                  stroke="#4dfbb1"
                  strokeWidth="1.6"
                  strokeDasharray="4 8"
                  className="animate-dash-flow"
                  opacity="0.35"
                />
                {/* Travelling pulse */}
                <circle r="3" fill="#4dfbb1">
                  <animateMotion
                    dur={`${2.6 + index * 0.35}s`}
                    repeatCount="indefinite"
                    path={d}
                    begin={`${index * 0.45}s`}
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    dur={`${2.6 + index * 0.35}s`}
                    repeatCount="indefinite"
                    begin={`${index * 0.45}s`}
                  />
                </circle>
              </g>
            );
          })}
        </svg>

        {NODES.map((node, index) => {
          const styleValue = KIND_STYLE[node.kind];
          const Icon = styleValue.icon;
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'absolute rounded-xl border bg-ink-850/95 px-2.5 py-2 shadow-lg backdrop-blur-sm',
                styleValue.ring,
              )}
              styleValue={{ left: `${(node.x / 640) * 100}%`, top: node.y, width: NODE_W }}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn('h-3 w-3 shrink-0', styleValue.tint)} />
                <span className="truncate text-[10.5px] font-semibold text-slate-200">{node.title}</span>
              </div>
              {node.options && (
                <div className="mt-1.5 space-y-1">
                  {node.options.map((option) => (
                    <div
                      key={option}
                      className="truncate rounded border border-white/[0.07] bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400"
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
              <span
                className={cn(
                  'absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-ink-900',
                  node.kind === 'end' ? 'bg-transparent' : 'bg-mint-400',
                )}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}


// kept around until the new implementation is verified
const KIND_STYLEV1: Record<PreviewNode['kind'], { ring: string; icon: typeof Bot; tint: string }> = {
  start: { ring: 'border-mint-400/40', icon: PlayCircle, tint: 'text-mint-300' },
  question: { ring: 'border-electric-400/35', icon: MessageSquare, tint: 'text-electric-300' },
  ai: { ring: 'border-violet-400/40', icon: Sparkles, tint: 'text-violet-300' },
  branch: { ring: 'border-amber-400/35', icon: GitBranch, tint: 'text-amber-300' },
  end: { ring: 'border-rose-400/35', icon: Bot, tint: 'text-rose-300' },
};