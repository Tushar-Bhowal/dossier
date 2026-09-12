import type { LlmCallParams, LlmPort } from '../../ports/llm.js';

export interface LlmChainOptions {
  primary: LlmPort;
  fallback: LlmPort | null;
}

// Mirrors createSearchChain (Tavily falling back to keyless search): today's outage was a single
// provider having a bad day — a fresh key locked out of a model, a daily quota that resets to
// zero — and no amount of retry logic inside one provider's adapter can route around that. A
// second, independent provider can. `primary` has already exhausted its own retries by the time
// it throws, so falling over here costs one extra call, not a duplicated retry storm.
export function createLlmChain({ primary, fallback }: LlmChainOptions): LlmPort {
  if (!fallback) return primary;
  return {
    async generate<T>(params: LlmCallParams<T>): Promise<T> {
      try {
        return await primary.generate(params);
      } catch {
        return fallback.generate(params);
      }
    },
  };
}
