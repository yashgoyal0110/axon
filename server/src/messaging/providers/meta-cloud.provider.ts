import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ChannelProvider } from '@prisma/client';
import * as crypto from 'crypto';
import type {
  ChannelCredentials,
  ChannelCredentialsMeta,
  InboundMessage,
  OutboundMessage,
  ProviderAdapter,
  SendResult,
  WebhookRequest,
  WebhookVerification,
} from '../provider.types';

const GRAPH_VERSION = 'v21.0';
// Meta renders at most three interactive reply buttons.
const MAX_BUTTONS = 3;

/**
 * WhatsApp Business Platform (Cloud API) - the direct-from-Meta path.
 */
@Injectable()
export class MetaCloudProvider implements ProviderAdapter {
  readonly provider = ChannelProvider.META_CLOUD;
  readonly requiresCredentials = true;
  private readonly logger = new Logger(MetaCloudProvider.name);

  validateCredentials(credentials: Record<string, unknown>): ChannelCredentialsMeta {
    const phoneNumberId = String(credentials.phoneNumberId ?? '').trim();
    const accessToken = String(credentials.accessToken ?? '').trim();
    if (!phoneNumberId) throw new BadRequestException('phoneNumberId is required for a Meta Cloud channel');
    if (!accessToken) throw new BadRequestException('accessToken is required for a Meta Cloud channel');
    return {
      phoneNumberId,
      accessToken,
      appSecret: String(credentials.appSecret ?? '').trim() || undefined,
      businessAccountId: String(credentials.businessAccountId ?? '').trim() || undefined,
    };
  }

  credentialSchema() {
    return [
      {
        key: 'phoneNumberId',
        label: 'Phone number ID',
        secret: false,
        required: true,
        help: 'Meta app dashboard → WhatsApp → API Setup',
      },
      {
        key: 'accessToken',
        label: 'Permanent access token',
        secret: true,
        required: true,
        help: 'Generate a System User token with whatsapp_business_messaging',
      },
      {
        key: 'appSecret',
        label: 'App secret',
        secret: true,
        required: false,
        help: 'Enables X-Hub-Signature-256 webhook verification. Strongly recommended.',
      },
      {
        key: 'businessAccountId',
        label: 'WABA ID',
        secret: false,
        required: false,
      },
    ];
  }

  async send(message: OutboundMessage, credentials: ChannelCredentials): Promise<SendResult> {
    const creds = credentials as ChannelCredentialsMeta;
    const to = message.to.replace(/[^\d]/g, '');

    const buttons = (message.buttons ?? []).slice(0, MAX_BUTTONS);
    // Anything beyond three buttons is folded into the body as a numbered list
    // so no option is silently dropped.
    const overflow = (message.buttons ?? []).slice(MAX_BUTTONS);
    const body =
      overflow.length > 0
        ? `${message.text}\n\n${overflow.map((o, i) => `${MAX_BUTTONS + i + 1}. ${o}`).join('\n')}`
        : message.text;

    const payload = buttons.length
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: body.slice(0, 1024) },
            action: {
              buttons: buttons.map((title, index) => ({
                type: 'reply',
                reply: { id: `response-${index}`, title: title.slice(0, 20) },
              })),
            },
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: body.slice(0, 4096) },
        };

    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${creds.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${creds.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const reason = json.error?.message ?? `HTTP ${response.status}`;
      this.logger.warn(`Meta send failed: ${reason}`);
      throw new Error(`Meta Cloud API: ${reason}`);
    }

    return { providerMessageId: json.messages?.[0]?.id, raw: json };
  }

  verify(request: WebhookRequest, verifyToken?: string | null): WebhookVerification | undefined {
    if (request.method !== 'GET') return undefined;
    const mode = request.query['hub.mode'];
    const tmpToken = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];
    if (mode === 'subscribe' && verifyToken && tmpToken === verifyToken) {
      return { challenge: String(challenge ?? '') };
    }
    return { challenge: undefined };
  }

  verifySignature(request: WebhookRequest, credentials: ChannelCredentials): boolean {
    const creds = credentials as ChannelCredentialsMeta;
    // Without an app secret configured there is nothing to check against.
    if (!creds?.appSecret) return true;

    const header = request.headers['x-hub-signature-256'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature?.startsWith('sha256=')) return false;
    if (!request.rawBody) return false;

    const expected = crypto
      .createHmac('sha256', creds.appSecret)
      .update(request.rawBody)
      .digest('hex');
    const provided = signature.slice('sha256='.length);

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseInbound(request: WebhookRequest): InboundMessage[] {
    const body = request.body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
            messages?: Array<{
              id?: string;
              from?: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
              interactive?: {
                button_reply?: { id?: string; title?: string };
                list_reply?: { id?: string; title?: string };
              };
              button?: { text?: string };
            }>;
          };
        }>;
      }>;
    };

    const results: InboundMessage[] = [];
    for (const entry of body?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const profileName = value?.contacts?.[0]?.profile?.name;
        for (const message of value?.messages ?? []) {
          // Interactive replies carry the button title, not a text body.
          const text =
            message.text?.body ??
            message.interactive?.button_reply?.title ??
            message.interactive?.list_reply?.title ??
            message.button?.text ??
            '';
          if (!message.from || !text) continue;
          results.push({
            waId: message.from,
            profileName,
            text,
            providerMessageId: message.id,
            timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
          });
        }
      }
    }
    return results;
  }
}
