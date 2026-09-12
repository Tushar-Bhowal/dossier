import { z, type ZodType } from 'zod';
import { LlmCallError, type LlmCallParams, type LlmModel, type LlmPort } from '../../ports/llm.js';
import type { RateLimiter } from './rateLimiter.js';

// Groq retired the llama-3.x free-tier models this pointed to; confirmed live via GroqClient.generate().
const MODEL_IDS: Record<LlmModel, string> = {
  flash: 'openai/gpt-oss-120b',
  'flash-lite': 'openai/gpt-oss-20b',
};

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const DEFAULT_MAX_ATTEMPTS = 5;
const BACKOFF_CAP_MS = 30_000;
const BACKOFF_BASE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RetryableGroqError extends Error {
  constructor(
    message: string,
    public readonly retryDelayMs?: number,
  ) {
    super(message);
    this.name = 'RetryableGroqError';
  }
}

function backoffDelayMs(attempt: number, retryDelayMs?: number): number {
  if (retryDelayMs !== undefined) return Math.min(retryDelayMs, BACKOFF_CAP_MS);
  const max = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  return Math.random() * max;
}

function parseRetryDelayMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isNaN(seconds) ? undefined : seconds * 1000;
}

function tryValidate<T>(schema: ZodType<T>, text: string): { success: true; data: T } | { success: false; message: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { success: false, message: `response was not valid JSON: ${(err as Error).message}` };
  }
  const result = schema.safeParse(json);
  if (result.success) return { success: true, data: result.data };
  return { success: false, message: z.prettifyError(result.error) };
}

export interface GroqClientOptions {
  apiKey: string;
  rateLimiter: RateLimiter;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  maxAttempts?: number;
}

// A second provider behind the same LlmPort interface, so it can stand in for GeminiClient via
// createLlmChain without any pipeline step knowing the difference. Structured output relies on
// Groq's OpenAI-compatible response_format:json_object plus the same schema-validate-then-repair
// loop GeminiClient uses, rather than a provider-specific schema constraint — a strategy that
// works the same way regardless of which provider is actually answering.
export class GroqClient implements LlmPort {
  private readonly apiKey: string;
  private readonly rateLimiter: RateLimiter;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly maxAttempts: number;

  constructor(options: GroqClientOptions) {
    this.apiKey = options.apiKey;
    this.rateLimiter = options.rateLimiter;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.groq.com/openai/v1';
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  async generate<T>(params: LlmCallParams<T>): Promise<T> {
    const estimatedTokens =
      Math.ceil((params.system.length + params.prompt.length) / 4) +
      (params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS);

    const rawText = await this.callWithRetry(params, estimatedTokens);
    const firstAttempt = tryValidate(params.schema, rawText);
    if (firstAttempt.success) return firstAttempt.data;

    const repairParams: LlmCallParams<T> = {
      ...params,
      prompt:
        `Your previous response did not satisfy the required schema.\n\n` +
        `--- YOUR PREVIOUS RESPONSE ---\n${rawText}\n--- END PREVIOUS RESPONSE ---\n\n` +
        `Validation errors:\n${firstAttempt.message}\n\n` +
        `Respond again with corrected JSON satisfying the schema exactly, for the original request below.\n\n` +
        `--- ORIGINAL REQUEST ---\n${params.prompt}\n--- END ORIGINAL REQUEST ---`,
    };
    const repairText = await this.callWithRetry(repairParams, estimatedTokens);
    const repairAttempt = tryValidate(params.schema, repairText);
    if (repairAttempt.success) return repairAttempt.data;

    throw new LlmCallError(
      `Groq response failed schema validation twice for model "${params.model}": ${repairAttempt.message}`,
    );
  }

  private async callWithRetry(params: LlmCallParams<unknown>, estimatedTokens: number): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.rateLimiter.acquire(estimatedTokens);
      try {
        return await this.callOnce(params);
      } catch (err) {
        if (err instanceof RetryableGroqError && attempt < this.maxAttempts) {
          lastError = err;
          await sleep(backoffDelayMs(attempt, err.retryDelayMs));
          continue;
        }
        if (err instanceof RetryableGroqError) {
          throw new LlmCallError(`Groq call failed after ${this.maxAttempts} attempts: ${err.message}`, err);
        }
        throw err;
      }
    }
    throw new LlmCallError('Groq call failed after retries', lastError);
  }

  private async callOnce(params: LlmCallParams<unknown>): Promise<string> {
    const model = MODEL_IDS[params.model];
    const url = `${this.baseUrl}/chat/completions`;
    // Groq's json_object mode 400s unless the word "json" appears somewhere in the messages;
    // the shared pipeline prompts are provider-agnostic and don't guarantee that.
    const system = /\bjson\b/i.test(params.system) ? params.system : `${params.system}\n\nRespond with a single JSON object.`;
    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: params.prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new RetryableGroqError(`network error calling Groq: ${(err as Error).message}`);
    }

    if (response.status === 429 || response.status >= 500) {
      throw new RetryableGroqError(`Groq returned ${response.status}`, parseRetryDelayMs(response));
    }
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new LlmCallError(`Groq returned ${response.status}: ${errorBody}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = payload.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== 'string') {
      const reason = choice?.finish_reason ?? 'unknown';
      throw new LlmCallError(`Groq response contained no message content (finish_reason: ${reason})`);
    }
    return text;
  }
}
