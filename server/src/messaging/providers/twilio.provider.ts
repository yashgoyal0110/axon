import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ChannelProvider } from '@prisma/client';
import * as crypto from 'crypto';
import type {
  ChannelCredentials,
  ChannelCredentialsTwilio,
  InboundMessage,
  OutboundMessage,
  ProviderAdapter,
  SendResult,
  WebhookRequest,
} from '../provider.types';

/**
 * Twilio Programmable Messaging for WhatsApp - the path most teams already have
 * access to via the Twilio sandbox number.
 */
@Injectable()
export class TwilioProvider implements ProviderAdapter {
  readonly provider = ChannelProvider.TWILIO;
  readonly requiresCredentials = true;
  private readonly logger = new Logger(TwilioProvider.name);

  validateCredentials(credentials: Record<string, unknown>): ChannelCredentialsTwilio {
    const accountSid = String(credentials.accountSid ?? '').trim();
    const authToken = String(credentials.authToken ?? '').trim();
    const fromNumber = String(credentials.fromNumber ?? '').trim();

    if (!/^AC[0-9a-f]{32}$/i.test(accountSid)) {
      throw new BadRequestException('accountSid must look like ACxxxxxxxx… (34 characters)');
    }
    if (!authToken) throw new BadRequestException('authToken is required for a Twilio channel');
    if (!fromNumber) throw new BadRequestException('fromNumber is required (e.g. +14155238886)');

    return { accountSid, authToken, fromNumber: this.normalise(fromNumber) };
  }

  credentialSchema() {
    return [
      {
        key: 'accountSid',
        label: 'Account SID',
        secret: false,
        required: true,
        help: 'Twilio Console → Account Info',
      },
      { key: 'authToken', label: 'Auth token', secret: true, required: true },
      {
        key: 'fromNumber',
        label: 'WhatsApp sender',
        secret: false,
        required: true,
        help: 'The Twilio WhatsApp number, e.g. +14155238886',
      },
    ];
  }

  async send(message: OutboundMessage, credentials: ChannelCredentials): Promise<SendResult> {
    const creds = credentials as ChannelCredentialsTwilio;

    // Twilio WhatsApp has no native quick-reply for freeform sessions, so
    // options are rendered as a numbered list the contact replies to.
    const body = message.buttons?.length
      ? `${message.text}\n\n${message.buttons.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
      : message.text;

    const form = new URLSearchParams({
      From: this.normalise(creds.fromNumber),
      To: this.normalise(message.to),
      Body: body.slice(0, 1600),
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(15_000),
      },
    );

    const json = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!response.ok) {
      const reason = json.message ?? `HTTP ${response.status}`;
      this.logger.warn(`Twilio send failed: ${reason}`);
      throw new Error(`Twilio: ${reason}`);
    }

    return { providerMessageId: json.sid, raw: json };
  }

  verify(): undefined {
    return undefined;
  }

  /**
   * Twilio signs `url + sorted(key + value)` with HMAC-SHA1 over the auth token.
   * https://www.twilio.com/docs/usage/security#validating-requests
   */
  verifySignature(request: WebhookRequest, credentials: ChannelCredentials, publicUrl: string): boolean {
    const creds = credentials as ChannelCredentialsTwilio;
    const header = request.headers['x-twilio-signature'];
    const signature = Array.isArray(header) ? header[0] : header;

    // Absent header means the request did not come from Twilio's edge. We only
    // hard-fail when an auth token exists to check against.
    if (!signature) return !creds?.authToken;
    if (!creds?.authToken) return false;

    const params = (request.body ?? {}) as Record<string, string>;
    const url = `${publicUrl.replace(/\/$/, '')}${request.url}`;

    const payload = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + String(params[key] ?? ''), url);

    const expected = crypto.createHmac('sha1', creds.authToken).update(Buffer.from(payload, 'utf8')).digest('base64');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseInbound(request: WebhookRequest): InboundMessage[] {
    const body = (request.body ?? {}) as Record<string, string>;
    const from = body.From ?? body.from;
    const text = body.Body ?? body.body;
    if (!from || typeof text !== 'string' || !text.length) return [];

    return [
      {
        waId: from.replace(/^whatsapp:/, '').replace(/[^\d+]/g, ''),
        profileName: body.ProfileName,
        text,
        providerMessageId: body.MessageSid ?? body.SmsMessageSid,
        timestamp: new Date(),
      },
    ];
  }

  private normalise(value: string): string {
    const trimmed = value.trim();
    return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/[^\d]/g, '')}`}`;
  }
}
