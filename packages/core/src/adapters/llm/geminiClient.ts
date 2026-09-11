import { z, type ZodType } from 'zod';
import { LlmCallError, type LlmCallParams, type LlmModel, type LlmPort } from '../../ports/llm.js';
import type { RateLimiter } from './rateLimiter.js';

const MODEL_IDS: Record<LlmModel, string> = {
  flash: 'gemini-2.5-flash',
  'flash-lite': 'gemini-2.5-flash-lite',
};

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const DEFAULT_MAX_ATTEMPTS = 5;
const BACKOFF_CAP_MS = 30_000;
const BACKOFF_BASE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RetryableGeminiError extends Error {
  constructor(
    message: string,
    public readonly retryDelayMs?: number,
  ) {
    super(message);
    this.name = 'RetryableGeminiError';
  }
}

// Gemini's responseSchema accepts a constrained subset of JSON Schema — strip the keywords
// z.toJSONSchema emits that Gemini's API rejects, keeping the structural keywords it does support.
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema === null || typeof schema !== 'object') return schema;
  const { $schema, additionalProperties, $id, ...rest } = schema as Record<string, unknown>;
  void $schema;
  void additionalProperties;
  void $id;
  for (const key of Object.keys(rest)) {
    rest[key] = toGeminiSchema(rest[key]);
  }
  return rest;
}

function backoffDelayMs(attempt: number, retryDelayMs?: number): number {
  if (retryDelayMs !== undefined) return Math.min(retryDelayMs, BACKOFF_CAP_MS);
  const max = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  return Math.random() * max;
}

function parseRetryDelayMs(response: Response, body: unknown): number | undefined {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  const details = (body as { error?: { details?: unknown[] } } | undefined)?.error?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const retryDelay = (detail as { retryDelay?: string })?.retryDelay;
      if (typeof retryDelay === 'string' && retryDelay.endsWith('s')) {
        const seconds = Number(retryDelay.slice(0, -1));
        if (!Number.isNaN(seconds)) return seconds * 1000;
      }
    }
  }
  return undefined;
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

export interface GeminiClientOptions {
  apiKey: string;
  rateLimiter: RateLimiter;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  maxAttempts?: number;
}

export class GeminiClient implements LlmPort {
  private readonly apiKey: string;
  private readonly rateLimiter: RateLimiter;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly maxAttempts: number;

  constructor(options: GeminiClientOptions) {
    this.apiKey = options.apiKey;
    this.rateLimiter = options.rateLimiter;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  async generate<T>(params: LlmCallParams<T>): Promise<T> {
    const geminiSchema = toGeminiSchema(z.toJSONSchema(params.schema, { target: 'draft-7' }));
    const estimatedTokens =
      Math.ceil((params.system.length + params.prompt.length) / 4) +
      (params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS);

    const rawText = await this.callWithRetry(params, geminiSchema, estimatedTokens);
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
    const repairText = await this.callWithRetry(repairParams, geminiSchema, estimatedTokens);
    const repairAttempt = tryValidate(params.schema, repairText);
    if (repairAttempt.success) return repairAttempt.data;

    throw new LlmCallError(
      `Gemini response failed schema validation twice for model "${params.model}": ${repairAttempt.message}`,
    );
  }

  private async callWithRetry(
    params: LlmCallParams<unknown>,
    geminiSchema: unknown,
    estimatedTokens: number,
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.rateLimiter.acquire(estimatedTokens);
      try {
        return await this.callOnce(params, geminiSchema);
      } catch (err) {
        if (err instanceof RetryableGeminiError && attempt < this.maxAttempts) {
          lastError = err;
          await sleep(backoffDelayMs(attempt, err.retryDelayMs));
          continue;
        }
        if (err instanceof RetryableGeminiError) {
          throw new LlmCallError(`Gemini call failed after ${this.maxAttempts} attempts: ${err.message}`, err);
        }
        throw err;
      }
    }
    throw new LlmCallError('Gemini call failed after retries', lastError);
  }

  private async callOnce(params: LlmCallParams<unknown>, geminiSchema: unknown): Promise<string> {
    const model = MODEL_IDS[params.model];
    const url = `${this.baseUrl}/models/${model}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: params.system }] },
      contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
        maxOutputTokens: params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        // 2.5 models think by default, and thinking tokens count against maxOutputTokens — with
        // the small budgets used here that silently truncates the actual JSON response. Structured
        // extraction/generation doesn't need it.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        // The key travels as a header, not a query param — a query string can end up in proxy
        // and access logs; a header is far less likely to be logged anywhere in the request path.
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new RetryableGeminiError(`network error calling Gemini: ${(err as Error).message}`);
    }

    if (response.status === 429 || response.status >= 500) {
      const errorBody = await response.json().catch(() => undefined);
      throw new RetryableGeminiError(
        `Gemini returned ${response.status}`,
        parseRetryDelayMs(response, errorBody),
      );
    }
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new LlmCallError(`Gemini returned ${response.status}: ${errorBody}`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      // A non-"STOP" finish reason (MAX_TOKENS, SAFETY, RECITATION, ...) is why there's no text —
      // surfacing it turns an undiagnosable failure into a clear one.
      const reason = candidate?.finishReason ?? 'unknown';
      throw new LlmCallError(`Gemini response contained no text candidate (finishReason: ${reason})`);
    }
    return text;
  }
}
