import type { RunRecord, RunStore } from '../ports/runStore.js';
import type { Clock } from '../ports/clock.js';
import {
  createInitialContext,
  createPipelineSteps,
  type PipelineContext,
  type PipelineDeps,
  type StepDefinition,
} from './definition.js';

const DEFAULT_BUDGET_MS = 240_000;

export interface RunPipelineOptions {
  runStore: RunStore;
  deps: PipelineDeps;
  userId: string | null;
  idempotencyKey: string;
  jdText: string;
  companyUrl: string;
  daysAvailable: number;
  newRunId: () => string;
  clock?: Clock;
  // §9: the batch CLI runs this exact runner with budgetMs: Infinity — there's no serverless
  // wall-clock deadline to work around outside of the deployed API.
  budgetMs?: number;
  // Injectable so tests can exercise resume/skip-isolation against a small fake step graph
  // instead of the full real pipeline.
  steps?: StepDefinition[];
}

function nowIso(clock: Clock): string {
  return clock.now().toISOString();
}

// A step is done, in the sense that a resume should never touch it again, once it's `ok` (it
// succeeded) or `skipped` (a non-critical step failed and that outcome was recorded as final).
// Only `pending`, a crashed `running`, or a retryable `failed` step gets picked back up.
function isResumable(status: RunRecord['steps'][number]['status']): boolean {
  return status !== 'ok' && status !== 'skipped';
}

export async function runPipeline(options: RunPipelineOptions): Promise<RunRecord> {
  const clock = options.clock ?? { now: () => new Date() };
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const steps = options.steps ?? createPipelineSteps();

  let record = await options.runStore.findByIdempotencyKey(options.userId, options.idempotencyKey);
  if (!record) {
    record = {
      id: options.newRunId(),
      userId: options.userId,
      kitId: null,
      idempotencyKey: options.idempotencyKey,
      status: 'queued',
      steps: steps.map((step) => ({
        name: step.name,
        status: 'pending',
        startedAt: null,
        endedAt: null,
        attempts: 0,
      })),
      sourcesSkipped: [],
      createdAt: nowIso(clock),
      updatedAt: nowIso(clock),
      heartbeatAt: nowIso(clock),
    };
    await options.runStore.create(record);
  }

  // Resuming replays every already-`ok` step's stored output onto a fresh context, so completed
  // work is never redone and never re-billed to the LLM.
  let ctx = createInitialContext(options.jdText, options.companyUrl, options.daysAvailable);
  for (const step of record.steps) {
    if (step.status === 'ok' && step.output && typeof step.output === 'object') {
      ctx = { ...ctx, ...(step.output as Partial<PipelineContext>) };
    }
  }

  const startedAt = clock.now().getTime();
  record.status = 'running';

  const resumeIndex = record.steps.findIndex((step) => isResumable(step.status));
  const firstIndex = resumeIndex === -1 ? steps.length : resumeIndex;

  for (let i = firstIndex; i < steps.length; i += 1) {
    if (clock.now().getTime() - startedAt >= budgetMs) {
      record.status = 'partial';
      record.updatedAt = nowIso(clock);
      await options.runStore.update(record.id, { status: record.status, updatedAt: record.updatedAt });
      return record;
    }

    const stepDef = steps[i]!;
    const runStep = record.steps[i]!;

    // Belt-and-braces: skip anything already `ok`/`skipped` even mid-loop, replaying an `ok`
    // step's stored output the same way the pre-loop replay does. Not reachable with today's
    // linear step graph (resume already starts at the first resumable index), but it keeps the
    // "never re-run or lose a completed step" guarantee tied to each step's own stored status
    // rather than to the step graph happening to stay linear.
    if (!isResumable(runStep.status)) {
      if (runStep.status === 'ok' && runStep.output && typeof runStep.output === 'object') {
        ctx = { ...ctx, ...(runStep.output as Partial<PipelineContext>) };
      }
      continue;
    }

    runStep.status = 'running';
    runStep.startedAt = nowIso(clock);
    runStep.attempts += 1;
    record.heartbeatAt = nowIso(clock);
    record.updatedAt = record.heartbeatAt;
    await options.runStore.update(record.id, {
      steps: record.steps,
      status: record.status,
      heartbeatAt: record.heartbeatAt,
      updatedAt: record.updatedAt,
    });

    try {
      const output = await stepDef.run(ctx, options.deps);
      ctx = { ...ctx, ...output };
      if (output.sourcesSkipped) {
        record.sourcesSkipped = output.sourcesSkipped;
      }
      runStep.status = 'ok';
      runStep.endedAt = nowIso(clock);
      runStep.output = output;
      delete runStep.error;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      runStep.endedAt = nowIso(clock);

      if (stepDef.critical) {
        runStep.status = 'failed';
        runStep.error = message;
        record.status = 'failed';
        record.updatedAt = nowIso(clock);
        await options.runStore.update(record.id, {
          steps: record.steps,
          status: record.status,
          updatedAt: record.updatedAt,
          sourcesSkipped: record.sourcesSkipped,
        });
        return record;
      }

      runStep.status = 'skipped';
      runStep.note = message;
    }

    record.updatedAt = nowIso(clock);
    await options.runStore.update(record.id, {
      steps: record.steps,
      updatedAt: record.updatedAt,
      sourcesSkipped: record.sourcesSkipped,
    });
  }

  record.status = 'succeeded';
  record.updatedAt = nowIso(clock);
  await options.runStore.update(record.id, { status: record.status, updatedAt: record.updatedAt });
  return record;
}
