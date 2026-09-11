import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { assembleKit, createInitialContext, Kit, runPipeline, type RunRecord } from '@dossier/core';
import { MongoRunStore } from '../db/mongoRunStore.js';
import { createKit } from '../db/kits.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { AppError } from '../middleware/error.js';
import { buildPipelineDeps } from '../pipelineDeps.js';

const RunCreateBody = z.object({
  jd: z.string().min(1),
  company_url: z.url(),
  days: z.int().min(1).max(90),
});

function idempotencyKeyFor(userId: string, input: z.infer<typeof RunCreateBody>): string {
  return createHash('sha256').update(`${userId}|${input.jd}|${input.company_url}|${input.days}`).digest('hex');
}

// Replays every `ok` step's stored output onto a fresh context — the same reconstruction the
// runner and the batch CLI both do — to recover final pipeline state from a persisted RunRecord.
function contextFromRecord(record: RunRecord, input: { jdText: string; companyUrl: string; daysAvailable: number }) {
  let ctx = createInitialContext(input.jdText, input.companyUrl, input.daysAvailable);
  for (const step of record.steps) {
    if (step.status === 'ok' && step.output && typeof step.output === 'object') {
      ctx = { ...ctx, ...step.output };
    }
  }
  return ctx;
}

// A succeeded run that hasn't been assembled into a kit yet gets assembled and saved here, once.
// `record.kitId` is what makes this idempotent across a retried/duplicate call.
async function ensureKitSaved(
  runStore: MongoRunStore,
  record: RunRecord,
  userId: string,
  input: { jdText: string; companyUrl: string; daysAvailable: number },
): Promise<RunRecord> {
  if (record.status !== 'succeeded' || record.kitId) {
    return record;
  }
  const ctx = contextFromRecord(record, input);
  const kit = assembleKit(input, ctx, { now: () => new Date() });
  const validated = Kit.safeParse(kit);
  if (!validated.success) {
    throw new AppError(500, 'invalid_kit', `generated kit failed validation: ${validated.error.message}`);
  }
  const doc = await createKit(userId, validated.data, input);
  await runStore.update(record.id, { kitId: doc._id });
  return { ...record, kitId: doc._id };
}

function statusCodeFor(record: RunRecord): number {
  if (record.status === 'succeeded') return 201;
  if (record.status === 'partial') return 202;
  return 200;
}

export const runsRouter = Router();

runsRouter.use(requireAuth);

runsRouter.post('/', validateBody(RunCreateBody), async (req, res, next) => {
  try {
    const input = req.body as z.infer<typeof RunCreateBody>;
    const userId = req.userId!;
    const idempotencyKey = idempotencyKeyFor(userId, input);
    const runStore = new MongoRunStore();
    const pipelineInput = { jdText: input.jd, companyUrl: input.company_url, daysAvailable: input.days };

    let record: RunRecord;
    try {
      record = await runPipeline({
        runStore,
        deps: buildPipelineDeps(),
        userId,
        idempotencyKey,
        jdText: pipelineInput.jdText,
        companyUrl: pipelineInput.companyUrl,
        daysAvailable: pipelineInput.daysAvailable,
        newRunId: () => randomUUID(),
      });
    } catch (err) {
      // §10: the unique index is what actually rejects a duplicate submission; a race that hits
      // it mid-flight surfaces here as a create() throw — fall back to the run it collided with
      // rather than erroring the second submitter.
      const existing = await runStore.findByIdempotencyKey(userId, idempotencyKey);
      if (!existing) throw err;
      record = existing;
    }

    await runStore.setInput(record.id, pipelineInput);
    record = await ensureKitSaved(runStore, record, userId, pipelineInput);

    res.status(statusCodeFor(record)).json(record);
  } catch (err) {
    next(err);
  }
});

runsRouter.get('/:id', async (req, res, next) => {
  try {
    const runStore = new MongoRunStore();
    const record = await runStore.get(req.params.id!);
    if (!record || record.userId !== req.userId) {
      next(new AppError(404, 'not_found', 'run not found'));
      return;
    }
    res.json(record);
  } catch (err) {
    next(err);
  }
});

runsRouter.post('/:id/resume', async (req, res, next) => {
  try {
    const runStore = new MongoRunStore();
    let record = await runStore.get(req.params.id!);
    if (!record || record.userId !== req.userId) {
      next(new AppError(404, 'not_found', 'run not found'));
      return;
    }

    const input = await runStore.getInput(req.params.id!);
    if (!input) {
      next(new AppError(500, 'missing_run_input', 'this run has no stored input to resume from'));
      return;
    }

    if (record.status === 'succeeded' || record.status === 'failed') {
      record = await ensureKitSaved(runStore, record, req.userId!, input);
      res.status(statusCodeFor(record)).json(record);
      return;
    }

    record = await runPipeline({
      runStore,
      deps: buildPipelineDeps(),
      userId: req.userId!,
      idempotencyKey: record.idempotencyKey,
      jdText: input.jdText,
      companyUrl: input.companyUrl,
      daysAvailable: input.daysAvailable,
      newRunId: () => randomUUID(),
    });

    record = await ensureKitSaved(runStore, record, req.userId!, input);
    res.status(statusCodeFor(record)).json(record);
  } catch (err) {
    next(err);
  }
});
