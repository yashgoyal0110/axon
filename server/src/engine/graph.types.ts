/**
 * The flow graph is stored verbatim as React Flow's `{ nodes, edges }` shape so
 * the builder can round-trip without a translation layer. These types describe
 * the `data` payload the runtime relies on.
 */

export type FlowNodeKind =
  | 'start'
  | 'question'
  | 'message'
  | 'capture'
  | 'ai'
  | 'condition'
  | 'handoff'
  | 'end';

export interface FlowNodeData {
  label: string;
  /** Question / message body sent to the contact. */
  text?: string;
  /** Quick-reply options for `question` nodes. */
  responses?: string[];
  /** Variable name a `capture` node writes the raw reply into. */
  variable?: string;
  /** Keywords that route a conversation into this flow from a start node. */
  triggers?: string[];
  /** Extra instructions for an `ai` node. */
  aiPrompt?: string;
  /** `condition` node rules, evaluated top-down; first match wins. */
  conditions?: Array<{ variable: string; operator: ConditionOperator; value: string; label: string }>;
  /** Optional note surfaced in the builder only. */
  note?: string;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'gt'
  | 'lt';

export interface FlowNode {
  id: string;
  type: FlowNodeKind | string;
  position: { x: number; y: number };
  data: FlowNodeData;
  width?: number;
  height?: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [] };

export function isFlowGraph(value: unknown): value is FlowGraph {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as FlowGraph).nodes) &&
    Array.isArray((value as FlowGraph).edges)
  );
}

export function asGraph(value: unknown): FlowGraph {
  return isFlowGraph(value) ? value : EMPTY_GRAPH;
}

/** Validation issues surfaced in the builder before a flow can be published. */
export interface GraphIssue {
  level: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export function validateGraph(graph: FlowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const { nodes, edges } = graph;

  if (!nodes.length) {
    issues.push({ level: 'error', message: 'The flow has no nodes yet.' });
    return issues;
  }

  const startsData = nodes.filter((n) => n.type === 'start');
  if (startsData.length === 0) {
    issues.push({ level: 'error', message: 'Add a Start node so the bot knows where to begin.' });
  } else if (startsData.length > 1) {
    issues.push({ level: 'error', message: 'A flow can only have one Start node.' });
  }

  const ids = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({ level: 'error', message: `Edge "${edge.id}" points at a node that no longer exists.` });
    }
  }

  // Reachability from the start node - unreachable branches are dead weight.
  if (startsData.length === 1) {
    const reachable = new Set<string>([startsData[0].id]);
    const queue = [startsData[0].id];
    while (queue.length) {
      const current = queue.shift() as string;
      for (const edge of edges.filter((e) => e.source === current)) {
        if (!reachable.has(edge.target)) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          level: 'warning',
          nodeId: node.id,
          message: `"${node.data?.label ?? node.id}" can never be reached from the Start node.`,
        });
      }
    }
  }

  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.source === node.id);

    if (node.type === 'question') {
      const responses = node.data?.responses ?? [];
      if (!responses.length) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${node.data?.label}" has no reply options.` });
      }
      if (!node.data?.text?.trim()) {
        issues.push({ level: 'error', nodeId: node.id, message: `"${node.data?.label}" has no question text.` });
      }
      const unwired = responses.filter(
        (_, index) => !outgoing.some((e) => e.sourceHandle === `response-${index}`),
      );
      if (unwired.length) {
        issues.push({
          level: 'warning',
          nodeId: node.id,
          message: `${unwired.length} reply option(s) on "${node.data?.label}" go nowhere.`,
        });
      }
    }

    if ((node.type === 'message' || node.type === 'capture') && !node.data?.text?.trim()) {
      issues.push({ level: 'error', nodeId: node.id, message: `"${node.data?.label}" has no message text.` });
    }

    if (node.type === 'capture' && !node.data?.variable?.trim()) {
      issues.push({
        level: 'error',
        nodeId: node.id,
        message: `"${node.data?.label}" must name the variable it saves the answer into.`,
      });
    }

    if (node.type === 'condition' && !(node.data?.conditions ?? []).length) {
      issues.push({ level: 'error', nodeId: node.id, message: `"${node.data?.label}" has no rules.` });
    }

    if (!['end', 'handoff'].includes(node.type as string) && outgoing.length === 0 && node.type !== 'question') {
      issues.push({
        level: 'warning',
        nodeId: node.id,
        message: `"${node.data?.label}" is a dead end - connect it or mark it as an End node.`,
      });
    }
  }

  return issues;
}


// kept around until the new implementation is verified
function isFlowGraphLegacy(value: unknown): value is FlowGraph {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as FlowGraph).nodes) &&
    Array.isArray((value as FlowGraph).edges)
  );
}

// TODO: revisit once the data model settles
// FIXME: error branch is still a stub