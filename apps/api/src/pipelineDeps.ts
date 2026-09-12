import {
  GeminiClient,
  GroqClient,
  RateLimiter,
  HttpFetcher,
  TavilySearchAdapter,
  KeylessSearchAdapter,
  createSearchChain,
  createLlmChain,
  type PipelineDeps,
} from '@dossier/core';

let geminiRateLimiter: RateLimiter | null = null;
let groqRateLimiter: RateLimiter | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sharedGeminiRateLimiter(): RateLimiter {
  // One limiter per process, shared across every request — the same reason the batch CLI shares
  // one limiter across concurrent cases: the free-tier RPM/TPM budget is per key, not per request.
  if (!geminiRateLimiter) {
    geminiRateLimiter = new RateLimiter({
      rpm: parsePositiveInt(process.env.LLM_RPM, 15),
      tpm: parsePositiveInt(process.env.LLM_TPM, 1_000_000),
    });
  }
  return geminiRateLimiter;
}

function sharedGroqRateLimiter(): RateLimiter {
  // A separate limiter, not a shared one — Groq's own free-tier budget has nothing to do with
  // Gemini's, so throttling it against Gemini's numbers would be meaningless in both directions.
  if (!groqRateLimiter) {
    groqRateLimiter = new RateLimiter({
      rpm: parsePositiveInt(process.env.GROQ_RPM, 25),
      tpm: parsePositiveInt(process.env.GROQ_TPM, 1_000_000),
    });
  }
  return groqRateLimiter;
}

// §11 vs §9's escape hatch is CLI-only — ALLOW_PRIVATE_HOSTS is never read here, so the deployed
// API always rejects private/loopback company URLs regardless of environment.
export function buildPipelineDeps(): PipelineDeps {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required (see .env.example)');
  }
  const groqApiKey = process.env.GROQ_API_KEY;
  return {
    // GROQ_API_KEY is optional: without it, a Gemini failure is still a failure, exactly as
    // before. With it, an independent second provider stands behind Gemini — one provider having
    // a bad day (a quota reset, a model access change) no longer costs the whole run.
    llm: createLlmChain({
      // One attempt only when there is somewhere to fall back to: Gemini's retry ladder sleeps for
      // up to 30s per attempt, so re-asking a provider that just failed costs far more wall-clock
      // time than handing the call straight to an independent one — and a run that overruns its
      // budget is abandoned as `partial`. With no fallback configured there is nowhere else to go,
      // so Gemini keeps its full retry budget rather than turning a blip into a failed run.
      primary: new GeminiClient({
        apiKey,
        rateLimiter: sharedGeminiRateLimiter(),
        maxAttempts: groqApiKey ? 1 : undefined,
      }),
      fallback: groqApiKey
        ? new GroqClient({ apiKey: groqApiKey, rateLimiter: sharedGroqRateLimiter() })
        : null,
    }),
    fetcher: new HttpFetcher({ allowPrivateHosts: false }),
    search: createSearchChain({
      tavily: process.env.TAVILY_API_KEY ? new TavilySearchAdapter({ apiKey: process.env.TAVILY_API_KEY }) : null,
      keyless: new KeylessSearchAdapter(),
    }),
  };
}
