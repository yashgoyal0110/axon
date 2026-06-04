export type Role = 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER';
export type Plan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type PlanStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING';
export type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ChannelProvider = 'SANDBOX' | 'META_CLOUD' | 'TWILIO';
export type ChannelStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'ERROR';
export type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'HANDOFF';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageSource = 'FLOW' | 'AI' | 'AGENT' | 'SYSTEM';
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface SessionUser {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
}

export interface SessionOrg {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
  planStatus: PlanStatus;
  role: Role;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
  organization: SessionOrg;
  organizations: Array<{ id: string; name: string; slug: string; role: Role; plan: Plan }>;
}

export type Profile = Omit<Session, 'accessToken' | 'refreshToken' | 'expiresIn'>;

// -- flows -------------------------------------------------------------------

export type FlowNodeKind =
  | 'start'
  | 'message'
  | 'question'
  | 'capture'
  | 'ai'
  | 'condition'
  | 'handoff'
  | 'end';

export interface FlowNodeData {
  label: string;
  text?: string;
  responses?: string[];
  variable?: string;
  aiPrompt?: string;
  triggers?: string[];
  note?: string;
  conditions?: Array<{ variable: string; operator: string; value: string; label: string }>;
  [key: string]: unknown;
}

export interface GraphIssue {
  level: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export interface Flow {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: FlowStatus;
  version: number;
  graph: { nodes: unknown[]; edges: unknown[] };
  triggerKeywords: string[];
  aiEnabled: boolean;
  aiPersona: string | null;
  fallbackMessage: string;
  isDefault: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nodeCount?: number;
  issues?: number | GraphIssue[];
  _count?: { conversations: number; versions: number };
  createdBy?: { id: string; name: string } | null;
  channels?: Array<{ id: string; name: string; provider: ChannelProvider }>;
}

export interface FlowTemplate {
  key: string;
  name: string;
  category: string;
  description: string;
  accent: string;
  aiPersona: string;
  triggerKeywords: string[];
  nodeCount: number;
  edgeCount: number;
  graph?: { nodes: unknown[]; edges: unknown[] };
}

// -- channels ----------------------------------------------------------------

export interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  help?: string;
}

export interface ProviderInfo {
  provider: ChannelProvider;
  requiresCredentials: boolean;
  fields: CredentialField[];
}

export interface Channel {
  id: string;
  name: string;
  provider: ChannelProvider;
  status: ChannelStatus;
  phoneNumber: string | null;
  webhookId: string;
  verifyToken: string | null;
  flowId: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  configuredFields: string[];
  webhookUrl: string | null;
  flow?: { id: string; name: string; status: FlowStatus } | null;
}

// -- inbox -------------------------------------------------------------------

export interface Contact {
  id: string;
  waId: string;
  name: string | null;
  tags: string[];
  optedOut: boolean;
  lastSeenAt: string;
  createdAt: string;
  attributes?: Record<string, unknown>;
  _count?: { conversations: number };
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  source: MessageSource;
  body: string;
  payload?: { buttons?: string[] } | null;
  nodeId: string | null;
  status: MessageStatus;
  error: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  status: ConversationStatus;
  currentNodeId: string | null;
  variables: Record<string, unknown>;
  messageCount: number;
  aiMessageCount: number;
  startedAt: string;
  lastMessageAt: string;
  completedAt: string | null;
  contact: Contact;
  channel: { id: string; name: string; provider: ChannelProvider };
  flow?: { id: string; name: string; status?: FlowStatus } | null;
  lastMessage?: { body: string; direction: MessageDirection; createdAt: string } | null;
  messages?: Message[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// -- billing + analytics -----------------------------------------------------

export interface PlanDefinition {
  id: Plan;
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  limits: {
    messagesPerMonth: number;
    aiCallsPerMonth: number;
    flows: number;
    channels: number;
    seats: number;
    apiKeys: number;
    analyticsRetentionDays: number;
  };
  providers: ChannelProvider[];
  highlights: string[];
  popular?: boolean;
}

export interface QuotaSnapshot {
  plan: PlanDefinition;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
  period: string;
  usage: {
    messagesIn: number;
    messagesOut: number;
    aiCalls: number;
    conversations: number;
    messagesTotal: number;
  };
  counts: { flows: number; channels: number; seats: number; apiKeys: number; contacts: number };
  remaining: { messages: number; aiCalls: number };
  percentUsed: { messages: number; aiCalls: number };
}

export interface Overview {
  range: { from: string; to: string; days: number };
  totals: {
    conversations: number;
    conversationsCompleted: number;
    messagesIn: number;
    messagesOut: number;
    aiReplies: number;
    contacts: number;
    activeNow: number;
  };
  rates: {
    completionRate: number;
    aiDeflectionRate: number;
    handoffRate: number;
    avgMessagesPerConversation: number;
    avgResponseMs: number;
  };
  deltas: { conversations: number; messages: number; completionRate: number };
  series: Array<{
    date: string;
    messagesIn: number;
    messagesOut: number;
    conversationsStarted: number;
    conversationsCompleted: number;
    aiCalls: number;
  }>;
}

export interface FlowPerformance {
  id: string;
  name: string;
  status: FlowStatus;
  started: number;
  completed: number;
  handoff: number;
  messages: number;
  completionRate: number;
}

export interface FunnelNode {
  id: string;
  label: string;
  type: string;
  reached: number;
  waiting: number;
  reachRate: number;
}

// -- team --------------------------------------------------------------------

export interface Member {
  id: string;
  role: Role;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null; lastLoginAt: string | null };
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  token: string;
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  key?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}


// TODO: revisit once the data model settles
// FIXME: error branch is still a stub