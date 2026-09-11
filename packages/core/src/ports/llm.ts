import type { ZodType } from 'zod';

export type LlmModel = 'flash' | 'flash-lite';

export interface LlmCallParams<T> {
  model: LlmModel;
  system: string;
  prompt: string;
  schema: ZodType<T>;
  maxOutputTokens?: number;
}

// Thrown after the adapter's own retries/repair attempt are exhausted, so a step can catch it and
// record a gap instead of failing the whole run.
export class LlmCallError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LlmCallError';
  }
}

export interface LlmPort {
  generate<T>(params: LlmCallParams<T>): Promise<T>;
}
