import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GenerateOptions {
  system?: string;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /**
   * Whether the model may spend tokens on internal reasoning.
   *
   * Reasoning tokens count against maxOutputTokens, and on the 2.5+/3.x Flash
   * models they routinely consume 300-500 - enough to truncate a short chat
   * reply to a few words. Leave this off for conversational turns and on for
   * structured generation, where the extra deliberation earns its cost.
   */
  thinking?: boolean;
}

/**
 * Thin REST client for the Gemini generateContent endpoint.
 * Called over plain fetch rather than an SDK so the surface stays small and
 * the request/response shape is pinned by this file alone.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('app.ai.apiKey');
  }

  get model(): string {
    return this.config.get<string>('app.ai.model') ?? 'gemini-2.5-flash';
  }

  async generate(turns: GeminiTurn[], options: GenerateOptions = {}): Promise<string> {
    const apiKey = this.config.get<string>('app.ai.apiKey');
    if (!apiKey) throw new ServiceUnavailableException('AI is not configured on this instance');

    const buildBody = (withThinkingConfig: boolean): string =>
      JSON.stringify({
        contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
        ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 1024,
          ...(options.json ? { responseMimeType: 'application/json' } : {}),
          ...(withThinkingConfig ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
        safetySettings: [],
      });

    // Only Gemini 2.5+ accepts thinkingConfig. If the configured model rejects
    // it we retry once without, so swapping GEMINI_MODEL never hard-breaks AI.
    const wantsThinkingDisabled = options.thinking === false;
    let response = await this.post(apiKey, buildBody(wantsThinkingDisabled), options.timeoutMs);

    if (!response.ok && wantsThinkingDisabled && response.status === 400) {
      this.logger.warn(`${this.model} rejected thinkingConfig - retrying without it`);
      response = await this.post(apiKey, buildBody(false), options.timeoutMs);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(`Gemini ${response.status}: ${detail.slice(0, 400)}`);
      throw new ServiceUnavailableException(
        response.status === 429
          ? 'The AI provider is rate limiting this key. Try again shortly.'
          : `AI provider returned ${response.status}`,
      );
    }

    const payloadValue = (await response.json()) as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: { thoughtsTokenCount?: number; candidatesTokenCount?: number };
    };

    const candidate = payloadValue.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

    // A MAX_TOKENS finish means the caller's ceiling was too low for this
    // model's reasoning overhead - surface it rather than shipping a fragment.
    if (candidate?.finishReason === 'MAX_TOKENS') {
      this.logger.warn(
        `Gemini hit the token ceiling (reasoning=${payload.usageMetadata?.thoughtsTokenCount ?? 0}, ` +
          `output=${payload.usageMetadata?.candidatesTokenCount ?? 0}). ` +
          'Raise maxOutputTokens or pass thinking: false.',
      );
      if (!text.trim()) throw new ServiceUnavailableException('AI response was truncated before any text');
    }

    return text.trim();
  }

  private post(apiKey: string, body: string, timeoutMs?: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 20_000);

    return fetch(`${API_ROOT}/${this.model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body,
    })
      .catch((error: Error) => {
        if (error.name === 'AbortError') throw new ServiceUnavailableException('AI request timed out');
        throw error;
      })
      .finally(() => clearTimeout(timeout));
  }

  /** Generates and parses JSON, tolerating a model that wraps output in a code fence. */
  async generateJson<T>(turns: GeminiTurn[], options: GenerateOptions = {}): Promise<T> {
    const raw = await this.generate(turns, { ...options, json: true });
    const cleaned = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Last resort: pull the outermost JSON object/array out of prose.
      const match = /[[{][\s\S]*[\]}]/.exec(cleaned);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          /* fall through */
        }
      }
      throw new ServiceUnavailableException('The AI returned a response that could not be parsed');
    }
  }
}
