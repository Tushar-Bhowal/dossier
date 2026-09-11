import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  BatchInput,
  BatchOutput,
  Kit,
  GeminiClient,
  RateLimiter,
  HttpFetcher,
  TavilySearchAdapter,
  KeylessSearchAdapter,
  createSearchChain,
  InMemoryRunStore,
  runPipeline,
  assembleKit,
  createInitialContext,
  type BatchCase,
  type BatchKitResult,
  type PipelineDeps,
} from '@dossier/core';

const CONCURRENCY = 2;

export function parseArgs(argv: string[]): { input: string; output: string; allowPrivateHosts: boolean } {
  const args = new Map<string, string>();
  let allowPrivateHosts = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg?.startsWith('--')) continue;
    if (arg === '--allow-private-hosts') {
      allowPrivateHosts = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for --${arg.slice(2)}`);
    }
    args.set(arg.slice(2), value);
    i += 1;
  }
  const input = args.get('input');
  const output = args.get('output');
  if (!input || !output) {
    throw new Error('usage: evaluate --input <cases.json> --output <kits.json> [--allow-private-hosts]');
  }
  return { input, output, allowPrivateHosts };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function processCase(
  batchCase: BatchCase,
  deps: PipelineDeps,
  runStore: InMemoryRunStore,
): Promise<BatchKitResult> {
  try {
    const record = await runPipeline({
      runStore,
      deps,
      userId: null, // §9: the batch CLI is entirely auth-free
      idempotencyKey: batchCase.id,
      jdText: batchCase.jd,
      companyUrl: batchCase.company_url,
      daysAvailable: batchCase.days,
      newRunId: () => randomUUID(),
      budgetMs: Infinity, // §9: this exact runner, no serverless deadline to work around here
    });

    if (record.status !== 'succeeded') {
      const failedStep = record.steps.find((step) => step.status === 'failed');
      return {
        id: batchCase.id,
        status: 'failed',
        kit: null,
        error: {
          code: 'pipeline-failed',
          message: failedStep
            ? `step "${failedStep.name}" failed: ${failedStep.error}`
            : `run ended with status "${record.status}"`,
        },
      };
    }

    // Replays every `ok` step's stored output onto a fresh context — the same reconstruction the
    // runner itself does on resume — to get the final pipeline state back out.
    let ctx = createInitialContext(batchCase.jd, batchCase.company_url, batchCase.days);
    for (const step of record.steps) {
      if (step.status === 'ok' && step.output && typeof step.output === 'object') {
        ctx = { ...ctx, ...step.output };
      }
    }

    const kit = assembleKit(
      { jdText: batchCase.jd, companyUrl: batchCase.company_url, daysAvailable: batchCase.days },
      ctx,
      { now: () => new Date() },
    );

    const validated = Kit.safeParse(kit);
    if (!validated.success) {
      return {
        id: batchCase.id,
        status: 'failed',
        kit: null,
        error: { code: 'invalid-kit', message: validated.error.message },
      };
    }

    return { id: batchCase.id, status: 'ok', kit: validated.data, error: null };
  } catch (err) {
    return {
      id: batchCase.id,
      status: 'failed',
      kit: null,
      error: { code: 'unexpected-error', message: err instanceof Error ? err.message : String(err) },
    };
  }
}

// Concurrency 2 (§9): cases run in parallel but all share one deps/runStore, so they queue through
// the same rate limiter rather than stampeding the free-tier RPM/TPM budget together.
export async function runBatch(
  cases: BatchCase[],
  deps: PipelineDeps,
  runStore: InMemoryRunStore,
): Promise<BatchKitResult[]> {
  const results: BatchKitResult[] = new Array(cases.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= cases.length) return;
      results[index] = await processCase(cases[index]!, deps, runStore);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, cases.length) }, worker));
  return results;
}

async function main(): Promise<void> {
  const { input, output, allowPrivateHosts } = parseArgs(process.argv.slice(2));

  const cases = BatchInput.parse(JSON.parse(readFileSync(input, 'utf8')));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required to run the batch evaluator (see .env.example)');
  }

  const rateLimiter = new RateLimiter({
    rpm: parsePositiveInt(process.env.LLM_RPM, 15),
    tpm: parsePositiveInt(process.env.LLM_TPM, 1_000_000),
  });
  const deps: PipelineDeps = {
    llm: new GeminiClient({ apiKey, rateLimiter }),
    // §11 vs §9: real batch runs stay SSRF-safe by default — only --allow-private-hosts (for
    // localhost fixture company sites) turns the gate off, never the whole run unconditionally.
    fetcher: new HttpFetcher({ allowPrivateHosts }),
    search: createSearchChain({
      tavily: process.env.TAVILY_API_KEY ? new TavilySearchAdapter({ apiKey: process.env.TAVILY_API_KEY }) : null,
      keyless: new KeylessSearchAdapter(),
    }),
  };
  const runStore = new InMemoryRunStore();

  const startedAt = Date.now();
  const results = await runBatch(cases, deps, runStore);
  const elapsedSeconds = (Date.now() - startedAt) / 1000;

  const succeeded = results.filter((r) => r.status === 'ok').length;
  console.log(
    `Processed ${results.length} case(s) in ${elapsedSeconds.toFixed(1)}s — ${succeeded} ok, ${results.length - succeeded} failed.`,
  );

  const batchOutput = BatchOutput.parse({
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results,
  });
  writeFileSync(output, JSON.stringify(batchOutput, null, 2));
}

// Only auto-run when executed directly (`tsx tools/evaluate/src/main.ts`) — importing this module
// from a test must not trigger a real CLI invocation.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
