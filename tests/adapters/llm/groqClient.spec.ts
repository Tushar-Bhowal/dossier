import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GroqClient, LlmCallError, RateLimiter } from '@dossier/core';

function groqResponse(content: string, status = 200, headers: Record<string, string> = {}): Response {
  const payload =
    status === 200 ? { choices: [{ message: { content } }] } : { error: { message: content } };
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

describe('GroqClient', () => {
  const schema = z.object({ text: z.string() });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns validated data on a clean successful call', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(groqResponse(JSON.stringify({ text: 'hello' })));
    const client = new GroqClient({
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
      .mockResolvedValueOnce(groqResponse(JSON.stringify({ wrong: true })))
      .mockResolvedValueOnce(groqResponse(JSON.stringify({ text: 'fixed' })));
    const client = new GroqClient({
      apiKey: 'key',
      rateLimiter: new RateLimiter({ rpm: 1000, tpm: 1_000_000 }),
      fetchImpl,
    });

    const result = await client.generate({ model: 'flash', system: 's', prompt: 'p', schema });
    expect(result).toEqual({ text: 'fixed' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws LlmCallError when the repair attempt also fails validation', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(groqResponse(JSON.stringify({ wrong: true }))));
    const client = new GroqClient({
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

  it('retries a 429 and recovers once the server does', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(groqResponse('rate limited', 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(groqResponse(JSON.stringify({ text: 'recovered' })));
    const client = new GroqClient({
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
  });

  it('gives up with LlmCallError after exhausting all attempts against a permanent 429 storm', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(groqResponse('rate limited', 429)));
    const client = new GroqClient({
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

  it('does not retry a non-retryable 4xx error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(groqResponse('bad request', 400));
    const client = new GroqClient({
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
