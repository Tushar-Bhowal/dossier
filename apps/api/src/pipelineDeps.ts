import {
  GeminiClient,
  RateLimiter,
  HttpFetcher,
  TavilySearchAdapter,
  KeylessSearchAdapter,
  createSearchChain,
  type PipelineDeps,
} from '@dossier/core';

let rateLimiter: RateLimiter | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sharedRateLimiter(): RateLimiter {
  // One limiter per process, shared across every request — the same reason the batch CLI shares
  // one limiter across concurrent cases: the free-tier RPM/TPM budget is per key, not per request.
  if (!rateLimiter) {
    rateLimiter = new RateLimiter({
      rpm: parsePositiveInt(process.env.LLM_RPM, 15),
      tpm: parsePositiveInt(process.env.LLM_TPM, 1_000_000),
    });
  }
  return rateLimiter;
}

// §11 vs §9's escape hatch is CLI-only — ALLOW_PRIVATE_HOSTS is never read here, so the deployed
// API always rejects private/loopback company URLs regardless of environment.
export function buildPipelineDeps(): PipelineDeps {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required (see .env.example)');
  }
  return {
    llm: new GeminiClient({ apiKey, rateLimiter: sharedRateLimiter() }),
    fetcher: new HttpFetcher({ allowPrivateHosts: false }),
    search: createSearchChain({
      tavily: process.env.TAVILY_API_KEY ? new TavilySearchAdapter({ apiKey: process.env.TAVILY_API_KEY }) : null,
      keyless: new KeylessSearchAdapter(),
    }),
  };
}
