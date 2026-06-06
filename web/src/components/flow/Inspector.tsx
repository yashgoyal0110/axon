import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, X } from 'lucide-react';
import type { Node } from 'reactflow';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import type { FlowNodeData, FlowNodeKind } from '@/lib/types';
import { NODE_STYLES } from './nodes';
import { cn } from '@/lib/utils';

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'gt', label: 'is greater than' },
  { value: 'lt', label: 'is less than' },
];

/** Right-hand editor for the selected node. */
export function Inspector({
  node,
  onChange,
  onDelete,
  onClose,
  readOnly,
}: {
  node: Node<FlowNodeData> | null;
  onChange: (id: string, patch: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="absolute right-0 top-0 z-20 flex h-full w-[330px] flex-col border-l border-white/[0.08] bg-ink-900/95 backdrop-blur-2xl"
        >
          <InspectorBody
            node={node}
            onChange={onChange}
            onDelete={onDelete}
            onClose={onClose}
            readOnly={readOnly}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function InspectorBody({
  node,
  onChange,
  onDelete,
  onClose,
  readOnly,
}: {
  node: Node<FlowNodeData>;
  onChange: (id: string, patch: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const kind = (node.type ?? 'message') as FlowNodeKind;
  const style = NODE_STYLES[kind];
  const Icon = style.icon;
  const data = node.data;

  const patch = (value: Partial<FlowNodeData>) => onChange(node.id, value);

  const responses = data.responses ?? [];
  const conditions = data.conditions ?? [];

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3.5">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', style.chip)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white">{data.label || style.label}</p>
          <p className="font-mono text-[10px] text-slate-600">{node.id}</p>
        </div>
        <button onClick={onClose} className="text-slate-600 transition-colors hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Field label="Node label" hint="Only shown to you, in the builder.">
          <Input value={data.label ?? ''} onChange={(e) => patch({ label: e.target.value })} disabled={readOnly} />
        </Field>

        {kind === 'start' && (
          <Field
            label="Trigger keywords"
            hint="Comma separated. Any of these routes a contact into this flow."
          >
            <Input
              value={(data.triggers ?? []).join(', ')}
              onChange={(e) =>
                patch({ triggers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
              }
              placeholder="hi, hello, help"
              disabled={readOnly}
            />
          </Field>
        )}

        {['message', 'question', 'capture', 'handoff', 'end'].includes(kind) && (
          <Field
            label="Message"
            hint="Insert captured values with {{variable_name}}."
            required={kind !== 'handoff' && kind !== 'end'}
          >
            <Textarea
              rows={4}
              value={data.text ?? ''}
              onChange={(e) => patch({ text: e.target.value })}
              placeholder={
                kind === 'question'
                  ? 'What can I help you with?'
                  : kind === 'capture'
                    ? 'What email should we use?'
                    : 'Thanks for getting in touch!'
              }
              disabled={readOnly}
            />
          </Field>
        )}

        {kind === 'ai' && (
          <Field
            label="AI instruction"
            hint="Sent to the model along with the transcript and your flow persona."
          >
            <Textarea
              rows={4}
              value={data.aiPrompt ?? ''}
              onChange={(e) => patch({ aiPrompt: e.target.value })}
              placeholder='The customer said: "{{lastMessage}}". Answer in under 50 words.'
              disabled={readOnly}
            />
          </Field>
        )}

        {kind === 'capture' && (
          <Field label="Save answer as" hint="Reference it later as {{variable}}." required>
            <Input
              value={data.variable ?? ''}
              onChange={(e) => patch({ variable: e.target.value.replace(/[^\w]/g, '_') })}
              placeholder="email"
              className="font-mono"
              disabled={readOnly}
            />
          </Field>
        )}

        {kind === 'question' && (
          <>
            <Field label="Save answer as" hint="Optional. Also stored as answer_<node id>.">
              <Input
                value={data.variable ?? ''}
                onChange={(e) => patch({ variable: e.target.value.replace(/[^\w]/g, '_') })}
                placeholder="topic"
                className="font-mono"
                disabled={readOnly}
              />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[13px] font-medium text-slate-300">Reply options</label>
                <Badge tone={responses.length > 3 ? 'amber' : 'slate'}>{responses.length}</Badge>
              </div>

              <div className="space-y-2">
                {responses.map((response, index) => (
                  <div key={index} className="flex gap-1.5">
                    <Input
                      value={response}
                      onChange={(e) => {
                        const next = [...responses];
                        next[index] = e.target.value;
                        patch({ responses: next });
                      }}
                      placeholder={`Option ${index + 1}`}
                      disabled={readOnly}
                    />
                    <button
                      onClick={() => patch({ responses: responses.filter((_, i) => i !== index) })}
                      disabled={readOnly}
                      className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                className="mt-2 w-full"
                disabled={readOnly}
                onClick={() => patch({ responses: [...responses, `Option ${responses.length + 1}`] })}
              >
                Add option
              </Button>

              {responses.length > 3 && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-amber-300/90">
                  WhatsApp shows at most three tappable buttons. Extra options are appended to the message as a
                  numbered list - contacts can still reply with the number.
                </p>
              )}
            </div>
          </>
                )}

                {kind === 'condition' && (
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-[13px] font-medium text-slate-300">Rules</label>
                            <Badge tone="slate">{conditions.length}</Badge>
                        </div>
                        <p className="mb-3 text-[11.5px] leading-relaxed text-slate-500">
                            Checked top to bottom. The first rule that matches wins; anything else takes the “otherwise” branch.
                        </p>

                        <div className="space-y-3">
                            {conditions.map((rule, index) => (
                                <div key={index} className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-slate-400">Rule {index + 1}</span>
                                        <button
                                            onClick={() => patch({ conditions: conditions.filter((_, i) => i !== index) })}
                                            disabled={readOnly}
                                            className="text-slate-600 hover:text-rose-400"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <Input
                                        value={rule.variable}
                                        onChange={(e) => {
                                            const next = [...conditions];
                                            next[index] = { ...rule, variable: e.target.value };
                                            patch({ conditions: next });
                                        }}
                                        placeholder="variable"
                                        className="font-mono text-[12px]"
                                        disabled={readOnly}
                                    />
                                    <Select
                                        value={rule.operator}
                                        onChange={(e) => {
                                            const next = [...conditions];
                                            next[index] = { ...rule, operator: e.target.value };
                      patch({ conditions: next });
                    }}
                    disabled={readOnly}
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </Select>
                  {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                    <Input
                      value={rule.value}
                      onChange={(e) => {
                        const next = [...conditions];
                        next[index] = { ...rule, value: e.target.value };
                        patch({ conditions: next });
                      }}
                      placeholder="value"
                      disabled={readOnly}
                    />
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              className="mt-2 w-full"
              disabled={readOnly}
              onClick={() =>
                patch({
                  conditions: [
                    ...conditions,
                    { variable: '', operator: 'equals', value: '', label: `Rule ${conditions.length + 1}` },
                  ],
                })
              }
            >
              Add rule
            </Button>
          </div>
        )}

        <Field label="Internal note" hint="Never sent to contacts.">
          <Textarea
            rows={2}
            value={data.note ?? ''}
            onChange={(e) => patch({ note: e.target.value })}
            disabled={readOnly}
          />
        </Field>
      </div>

      {kind !== 'start' && !readOnly && (
        <div className="border-t border-white/[0.07] p-3">
          <Button variant="danger" size="sm" icon={Trash2} className="w-full" onClick={() => onDelete(node.id)}>
            Delete node
          </Button>
        </div>
      )}
    </>
  );
}


// kept around until the new implementation is verified
function legacyInspector({
  node,
  onChange,
  onDelete,
  onClose,
  readOnly,
}: {
  node: Node<FlowNodeData> | null;
  onChange: (id: string, patch: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="absolute right-0 top-0 z-20 flex h-full w-[330px] flex-col border-l border-white/[0.08] bg-ink-900/95 backdrop-blur-2xl"
        >
          <InspectorBody
            node={node}
            onChange={onChange}
            onDelete={onDelete}
            onClose={onClose}
            readOnly={readOnly}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}