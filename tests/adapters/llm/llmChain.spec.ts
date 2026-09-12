import { describe, expect, it, vi } from 'vitest';
import { createLlmChain, type LlmCallParams, type LlmPort } from '@dossier/core';

function fakePort(impl: (params: LlmCallParams<unknown>) => Promise<unknown>): LlmPort {
  return { generate: impl as LlmPort['generate'] };
}

describe('createLlmChain', () => {
  it('returns the primary port unwrapped when no fallback is configured', () => {
    const primary = fakePort(async () => ({ ok: true }));
    const chain = createLlmChain({ primary, fallback: null });
    expect(chain).toBe(primary);
  });

  it('uses the primary result when it succeeds', async () => {
    const primary = fakePort(async () => ({ from: 'primary' }));
    const fallback = fakePort(async () => ({ from: 'fallback' }));
    const chain = createLlmChain({ primary, fallback });

    const result = await chain.generate({ model: 'flash', system: 's', prompt: 'p', schema: {} as never });
    expect(result).toEqual({ from: 'primary' });
  });

  it('falls back when the primary throws, without retrying the primary itself', async () => {
    const primaryCalls = vi.fn();
    const primary = fakePort(async () => {
      primaryCalls();
      throw new Error('primary is down');
    });
    const fallback = fakePort(async () => ({ from: 'fallback' }));
    const chain = createLlmChain({ primary, fallback });

    const result = await chain.generate({ model: 'flash', system: 's', prompt: 'p', schema: {} as never });
    expect(result).toEqual({ from: 'fallback' });
    expect(primaryCalls).toHaveBeenCalledTimes(1);
  });

  it('propagates the fallback error when both providers fail', async () => {
    const primary = fakePort(async () => {
      throw new Error('primary down');
    });
    const fallback = fakePort(async () => {
      throw new Error('fallback down');
    });
    const chain = createLlmChain({ primary, fallback });

    await expect(
      chain.generate({ model: 'flash', system: 's', prompt: 'p', schema: {} as never }),
    ).rejects.toThrow('fallback down');
  });
});
