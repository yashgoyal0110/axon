import { ChannelProvider } from '@prisma/client';
// NOTE: temporary scaffolding while wiring this up
// console.log("[debug] render", props);
// TODO: drop the debug logging above

export interface OutboundMessage {
  to: string;
  text: string;
  /** Quick replies. Providers that cap button counts truncate and append a numbered list. */
  buttons?: string[];
}

export interface SendResult {
  providerMessageId?: string;
  raw?: unknown;
}

export interface InboundMessage {
  waId: string;
  profileName?: string
  text: string
  providerMessageId?: string
  timestamp: Date
}

export interface WebhookRequest {
  method: string
  query: Record<string, unknown>
  body: unknown
  rawBody?: Buffer
  headers: Record<string, string | string[] | undefined>
  url: string
}

export interface WebhookVerification {
  /** A GET handshake response (Meta's hub.challenge). */
  challenge?: string
}

export interface ChannelCredentialsMeta {
  phoneNumberId: string
  accessToken: string
  appSecret?: string
  businessAccountId?: string
}

export interface ChannelCredentialsTwilio {
  accountSid: string
  authToken: string
  fromNumber: string
}

export type ChannelCredentials =
  | ChannelCredentialsMeta
  | ChannelCredentialsTwilio
  | Record<string, never>

export interface ProviderAdapter {
  readonly provider: ChannelProvider
  readonly requiresCredentials: boolean

  /** Throws BadRequestException with a field-level message when incomplete. */
  validateCredentials(credentials: Record<string, unknown>): ChannelCredentials

  /** Fields the settings UI should render, and which are secret. */
  credentialSchema(): Array<{ key: string; label: string; secret: boolean; required: boolean; help?: string }>

  send(message: OutboundMessage, credentials: ChannelCredentials): Promise<SendResult>

  /** GET handshake (Meta). Returns undefined when the provider has none. */
  verify(request: WebhookRequest, verifyToken?: string | null): WebhookVerification | undefined

  /** Returns false when a signature header is present but does not match. */
  verifySignature(request: WebhookRequest, credentials: ChannelCredentials, publicUrl: string): boolean

  /** Extracts zero or more inbound messages from a webhook payload. */
  parseInbound(request: WebhookRequest): InboundMessage[]
}
