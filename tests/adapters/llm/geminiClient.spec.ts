import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GeminiClient, LlmCallError, RateLimiter } from '@roleground/core';

function geminiResponse(text: string, status = 200, headers: Record<string, string> = {}): Response {
  const payload =
    status === 200
      ? { candidates: [{ content: { parts: [{ text }] } }] }
      : { error: { message: text } };
  return new Response(JSON.stringify(payload), { status, headers });
}

async function flushRetries(promise: Promise<unknown>): Promise<unknown> {
  const settle = promise.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  for (let i = 0; i < 10; i += 1) {
    await vi.advanceTimersByTimeAsync(30_000);
  }
  return settle;
}

describe('GeminiClient', () => {
  const schema = z.object({ text: z.string() });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns validated data on a clean successful call', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiResponse(JSON.stringify({ text: 'hello' })));
    const client = new GeminiClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
    });

    const result = await client.generate({ model: 'flash', system: 's', prompt: 'p', schema });
    expect(result).toEqual({ text: 'hello' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('repairs once when the first response fails schema validation, then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(JSON.stringify({ wrong: true })))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify({ text: 'fixed' })));
    const client = new GeminiClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
    });

    const result = await client.generate({ model: 'flash', system: 's', prompt: 'p', schema });
    expect(result).toEqual({ text: 'fixed' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws LlmCallError when the repair attempt also fails validation', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(geminiResponse(JSON.stringify({ wrong: true }))));
    const client = new GeminiClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
    });

    const outcome = (await flushRetries(
      client.generate({ model: 'flash', system: 's', prompt: 'p', schema }),
    )) as { ok: boolean; e?: unknown };
    expect(outcome.ok).toBe(false);
    expect(outcome.e).toBeInstanceOf(LlmCallError);
  });

  it('survives a 429 storm without an unhandled rejection, recovering once the server does', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse('rate limited', 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(geminiResponse('rate limited', 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(geminiResponse('rate limited', 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify({ text: 'recovered' })));
    const client = new GeminiClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
      maxAttempts: 5,
    });

    const outcome = (await flushRetries(
      client.generate({ model: 'flash', system: 's', prompt: 'p', schema }),
    )) as { ok: boolean; v?: unknown };
    expect(outcome.ok).toBe(true);
    expect(outcome.v).toEqual({ text: 'recovered' });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('gives up with LlmCallError after exhausting all attempts against a permanent 429 storm', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(geminiResponse('rate limited', 429)));
    const client = new GeminiClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
      maxAttempts: 3,
    });

    const outcome = (await flushRetries(
      client.generate({ model: 'flash', system: 's', prompt: 'p', schema }),
    )) as { ok: boolean; e?: unknown };
    expect(outcome.ok).toBe(false);
    expect(outcome.e).toBeInstanceOf(LlmCallError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  // How both pipelines wire Gemini whenever a Groq fallback is configured: one shot, no backoff,
  // so the chain can hand the call to the other provider instead of sleeping on this one.
  it('makes exactly one call and never backs off on a 429 when maxAttempts is 1', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(geminiResponse('rate limited', 429, { 'retry-after': '30' })));
    const client = new GeminiClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
      maxAttempts: 1,
    });

    // Deliberately not wrapped in flushRetries: this must settle without any timer advancing,
    // which is what proves no backoff sleep happened.
    await expect(
      client.generate({ model: 'flash', system: 's', prompt: 'p', schema }),
    ).rejects.toBeInstanceOf(LlmCallError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-retryable 4xx error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiResponse('bad request', 400));
    const client = new GeminiClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
    });

    await expect(client.generate({ model: 'flash', system: 's', prompt: 'p', schema })).rejects.toThrow(
      LlmCallError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
