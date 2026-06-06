import { Injectable, Logger } from '@nestjs/common';
import { ChannelProvider } from '@prisma/client';
import { nanoid } from 'nanoid';
import type {
  ChannelCredentials,
  InboundMessage,
  OutboundMessage,
  ProviderAdapter,
  SendResult,
  WebhookRequest,
} from '../provider.types';

/**
 * A fully in-process WhatsApp channel. Outbound messages are persisted by the
 * caller and read back by the in-app simulator, so the entire product - flows,
 * AI, analytics, quotas - is exercisable with no Meta or Twilio account.
 */
@Injectable()
export class SandboxProvider implements ProviderAdapter {
  readonly provider = ChannelProvider.SANDBOX;
  readonly requiresCredentials = false;
  private readonly logger = new Logger(SandboxProvider.name);

  validateCredentials(): ChannelCredentials {
    return {};
  }

  credentialSchema() {
    return [];
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    this.logger.debug(`sandbox -> ${message.to}: ${message.text.slice(0, 60)}`);
    return { providerMessageId: `sbx_${nanoid(16)}` };
  }

  verify(): undefined {
    return undefined;
  }

  verifySignature(): boolean {
    // The sandbox is only reachable through an authenticated API route.
    return true;
  }

  parseInbound(request: WebhookRequest): InboundMessage[] {
    const body = request.body as { waId?: string; text?: string; profileName?: string } | undefined;
    if (!body?.waId || typeof body.text !== 'string') return [];
    return [
      {
        waId: body.waId,
        text: body.text,
        profileName: body.profileName,
        providerMessageId: `sbx_in_${nanoid(16)}`,
        timestamp: new Date(),
      },
    ];
  }
}
