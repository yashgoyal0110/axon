import { motion } from 'framer-motion';
import { ArrowRight, Boxes, Layers, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Input, Reveal, SectionHeading, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';
import type { FlowTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Templates() {
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');

  useEffect(() => {
    get<FlowTemplate[]>('/flows/templates', { auth: false })
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const categories = useMemo(
    () => ['All', ...new Set((templates ?? []).map((t) => t.category))],
    [templates],
  );

  const filtered = useMemo(() => {
    if (!templates) return null;
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory = category === 'All' || template.category === category;
      const matchesQuery =
        !needle ||
        template.name.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [templates, query, category]);

  return (
    <div className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Templates"
          title="Skip the blank canvas"
          description="Production-shaped flows you can load, edit and publish. Each one wires questions, capture steps, branching and handoff the way it works in practice."
        />

        <Reveal delay={0.08}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                className="pl-10"
              />
            </div>
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors',
                    category === item
                      ? 'border-mint-400/30 bg-mint-400/10 text-mint-300'
                      : 'border-white/[0.07] bg-white/[0.02] text-slate-400 hover:text-white',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!filtered
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)
            : filtered.map((template, index) => (
                <Reveal key={template.key} delay={index * 0.06}>
                  <TemplateCard template={template} />
                </Reveal>
              ))}
        </div>

        {filtered?.length === 0 && (
          <EmptyState
            icon={Boxes}
            title="No templates match that search"
            description="Try a different term, or start from a blank canvas in the builder."
            action={
              <Link to="/register">
                <Button iconRight={ArrowRight}>Start from scratch</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: FlowTemplate }) {
  return (
    <Card hover className="group h-full p-6">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${template.accent}, transparent)` }}
      />

      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{ borderColor: `${template.accent}40`, backgroundColor: `${template.accent}14` }}
        >
          <Layers className="h-4.5 w-4.5" style={{ color: template.accent }} />
        </div>
        <Badge tone="slate">{template.category}</Badge>
      </div>

      <h3 className="mt-5 text-[15.5px] font-semibold text-white">{template.name}</h3>
      <p className="mt-2 min-h-[54px] text-[13.5px] leading-relaxed text-slate-400">{template.description}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {template.triggerKeywords.slice(0, 3).map((keyword) => (
          <span
            key={keyword}
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-slate-500"
          >
            {keyword}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
        <span className="text-[12px] text-slate-500">
          {template.nodeCount} steps · {template.edgeCount} paths
        </span>
        <Link
          to={`/register?template=${template.key}`}
          className="flex items-center gap-1 text-[12.5px] font-semibold text-mint-300 transition-colors hover:text-mint-200"
        >
          Use template
          <motion.span className="inline-block transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-3.5 w-3.5" />
          </motion.span>
        </Link>
      </div>
    </Card>
  );
}
