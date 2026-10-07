import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { z } from 'zod';
import {
  ApplicationInput,
  EMAIL_UPDATE_SYSTEM,
  EmailUpdateLlm,
  Interview,
  LlmCallError,
  ParseEmailRequest,
  applyProposal,
  applyStatusChange,
  buildEmailUpdatePrompt,
  localDateIn,
  matchApplication,
  normalizeInterviews,
  redact,
  zonedTimeToUtc,
  type Application,
  type ApplicationRecord,
  type LlmPort,
  type UpdateProposal,
} from '@dossier/core';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { buildPipelineDeps } from '../pipelineDeps.js';
import { createApplication, getOwnedApplication, listOwnedApplications, replaceOwnedApplication, toRecord } from '../db/applications.js';
import {
  countUpdatesSince,
  createEmailUpdate,
  getPendingUpdate,
  listPendingUpdates,
  reopenUpdate,
  settleUpdate,
  toUpdateRecord,
} from '../db/emailUpdates.js';
import { bookSoonReminders } from '../notify/index.js';

// Each parse is one AI call on a free-tier key shared by everyone.
const DAILY_PARSE_LIMIT = 20;

let llm: LlmPort | null = null;
function getLlm(): LlmPort {
  llm ??= buildPipelineDeps().llm;
  return llm;
}

// The AI only ever sees placeholders; the meeting link it points at is put back here, and only if
// it's a real web address.
function meetingLink(token: string | undefined, items: ReturnType<typeof redact>['items']): string | undefined {
  const value = items.find((i) => i.kind === 'link' && i.token === token)?.value;
  if (!value) return undefined;
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return Interview.shape.meetingUrl.safeParse(url).success ? url : undefined;
}

function toProposal(out: EmailUpdateLlm, items: ReturnType<typeof redact>['items'], timeZone: string, records: ApplicationRecord[]): UpdateProposal {
  let interview: Interview | undefined;
  if (out.interview) {
    const candidate = {
      id: randomUUID(),
      startsAt: zonedTimeToUtc(out.interview.start, timeZone),
      durationMin: out.interview.durationMin,
      round: out.round,
      meetingUrl: meetingLink(out.interview.link, items),
    };
    const parsed = Interview.safeParse(candidate);
    // An interview already over is old news, not something to put on the calendar.
    if (parsed.success && Date.parse(parsed.data.startsAt) > Date.now()) interview = parsed.data;
  }
  const match = matchApplication(records, out.company, out.role);
  return {
    applicationId: match?.id,
    company: match?.application.company ?? out.company.trim(),
    role: match?.application.role ?? out.role?.trim(),
    status: out.status,
    round: out.round,
    interview,
    summary: out.summary.trim(),
  };
}

async function applyToTracker(userId: string, proposal: UpdateProposal): Promise<ApplicationRecord> {
  const now = new Date();
  if (proposal.applicationId) {
    // Retried on a version clash: the user may be editing the same application in another tab.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await getOwnedApplication(proposal.applicationId, userId);
      if (!current) break;
      const next = applyProposal(ApplicationInput.parse(current.application), proposal);
      const application: Application = {
        ...next,
        ...applyStatusChange(current.application, next, now),
        interviews: normalizeInterviews(next.interviews),
        source: current.application.source,
      };
      const updated = await replaceOwnedApplication(current._id, userId, current.version, application);
      if (updated) return toRecord(updated);
    }
    if (await getOwnedApplication(proposal.applicationId, userId)) {
      throw new AppError(409, 'version_conflict', 'the application kept changing; try again');
    }
  }
  // No match, or the matched application was deleted meanwhile: track it as a new one.
  const next = applyProposal({ company: proposal.company, role: proposal.role || 'Role not stated', status: 'applied' }, proposal);
  const application: Application = {
    ...next,
    ...applyStatusChange(null, next, now),
    interviews: normalizeInterviews(next.interviews),
    source: 'manual',
  };
  return toRecord(await createApplication(userId, application));
}

export const emailUpdatesRouter = Router();
emailUpdatesRouter.use(requireAuth);

emailUpdatesRouter.get('/', async (req, res, next) => {
  try {
    res.json((await listPendingUpdates(req.userId!)).map(toUpdateRecord));
  } catch (err) {
    next(err);
  }
});

emailUpdatesRouter.post('/parse', validateBody(ParseEmailRequest), async (req, res, next) => {
  const { text, timezone } = req.body as z.infer<typeof ParseEmailRequest>;
  const userId = req.userId!;
  try {
    if ((await countUpdatesSince(userId, new Date(Date.now() - 86_400_000), 'email')) >= DAILY_PARSE_LIMIT) {
      next(new AppError(429, 'daily_limit', `you can read ${DAILY_PARSE_LIMIT} emails a day`));
      return;
    }
    // Personal details never reach the AI: emails, phone numbers and links become placeholders.
    const { text: safeText, items } = redact(text);
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long' }).format(now);
    let out: EmailUpdateLlm;
    try {
      out = await getLlm().generate({
        model: 'flash-lite',
        system: EMAIL_UPDATE_SYSTEM,
        prompt: buildEmailUpdatePrompt(safeText, `${weekday} ${localDateIn(timezone, now)}`, timezone),
        schema: EmailUpdateLlm,
        maxOutputTokens: 600,
      });
    } catch (err) {
      if (err instanceof LlmCallError) {
        next(new AppError(502, 'ai_unavailable', 'the email reader is busy; try again in a minute'));
        return;
      }
      throw err;
    }
    if (!out.isJobEmail || !out.company.trim()) {
      next(new AppError(422, 'not_job_email', "this doesn't look like an email about a job application"));
      return;
    }
    const records = (await listOwnedApplications(userId)).map(toRecord);
    const doc = await createEmailUpdate(userId, toProposal(out, items, timezone, records), 'email');
    res.status(201).json(toUpdateRecord(doc));
  } catch (err) {
    next(err);
  }
});

// Nothing changes in the tracker until the user taps Apply.
emailUpdatesRouter.post('/:id/apply', async (req, res, next) => {
  const { id } = req.params as { id: string };
  const userId = req.userId!;
  try {
    const doc = await getPendingUpdate(id, userId);
    if (!doc || !(await settleUpdate(id, userId, 'applied'))) {
      next(new AppError(404, 'not_found', 'update not found or already handled'));
      return;
    }
    try {
      const record = await applyToTracker(userId, doc.proposal);
      await bookSoonReminders(userId, record.id, record.application.interviews);
      res.json(record);
    } catch (err) {
      await reopenUpdate(id, userId);
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

emailUpdatesRouter.post('/:id/dismiss', async (req, res, next) => {
  try {
    if (!(await settleUpdate(req.params.id!, req.userId!, 'dismissed'))) {
      next(new AppError(404, 'not_found', 'update not found or already handled'));
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
