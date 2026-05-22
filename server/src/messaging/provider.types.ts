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

// TODO: finish the error/loading branches below
// (kept short on purpose while the shape firms up)
