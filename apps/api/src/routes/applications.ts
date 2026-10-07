import { Router, type Response } from 'express';
import {
  ApplicationCreate,
  ApplicationPatch,
  ApplicationPreviewRequest,
  HttpFetcher,
  applyStatusChange,
  normalizeInterviews,
  previewFromJobPage,
  type Application,
  type ApplicationPreview,
} from '@dossier/core';
import type { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import {
  createApplication,
  deleteOwnedApplication,
  findOwnedByJobUrl,
  getOwnedApplication,
  isDuplicateKey,
  listOwnedApplications,
  replaceOwnedApplication,
  toRecord,
} from '../db/applications.js';
import { bookSoonReminders } from '../notify/index.js';

const fetcher = new HttpFetcher({ allowPrivateHosts: false });

async function sendDuplicate(res: Response, userId: string, jobUrl: string): Promise<void> {
  const existing = await findOwnedByJobUrl(userId, jobUrl);
  res.status(409).json({
    code: 'duplicate',
    message: 'this job link is already tracked',
    existing: existing ? toRecord(existing) : undefined,
  });
}

export const applicationsRouter = Router();

applicationsRouter.use(requireAuth);

applicationsRouter.get('/', async (req, res, next) => {
  try {
    res.json((await listOwnedApplications(req.userId!)).map(toRecord));
  } catch (err) {
    next(err);
  }
});

// Best effort: a page that can't be fetched or has nothing useful gives empty fields, never an
// error, because the user can always type the details in.
applicationsRouter.post('/preview', validateBody(ApplicationPreviewRequest), async (req, res) => {
  const { url } = req.body as z.infer<typeof ApplicationPreviewRequest>;
  let preview: ApplicationPreview = {};
  try {
    const page = await fetcher.fetch(url);
    if (page.contentType.includes('html')) preview = previewFromJobPage(page.finalUrl, page.text);
  } catch {
    // unreachable, blocked by robots.txt or too large: fall through with nothing pre-filled
  }
  res.json(preview);
});

applicationsRouter.post('/', validateBody(ApplicationCreate), async (req, res, next) => {
  const input = req.body as z.output<typeof ApplicationCreate>;
  try {
    const { source, ...fields } = input;
    const application: Application = {
      ...fields,
      ...applyStatusChange(null, fields, new Date()),
      interviews: normalizeInterviews(fields.interviews),
      source,
    };
    const doc = await createApplication(req.userId!, application);
    await bookSoonReminders(req.userId!, doc._id, doc.application.interviews);
    res.status(201).json(toRecord(doc));
  } catch (err) {
    if (isDuplicateKey(err) && input.jobUrl) {
      await sendDuplicate(res, req.userId!, input.jobUrl).catch(next);
      return;
    }
    next(err);
  }
});

applicationsRouter.get('/:id', async (req, res, next) => {
  try {
    const doc = await getOwnedApplication(req.params.id!, req.userId!);
    if (!doc) {
      next(new AppError(404, 'not_found', 'application not found'));
      return;
    }
    res.json(toRecord(doc));
  } catch (err) {
    next(err);
  }
});

// Version goes in the body (same reason as kits: an If-Match header gets judged by the CDN).
// History and source are taken from the stored copy, never from the client.
applicationsRouter.patch('/:id', validateBody(ApplicationPatch), async (req, res, next) => {
  const { version, application: input } = req.body as z.infer<typeof ApplicationPatch>;
  const { id } = req.params as { id: string };
  try {
    const current = await getOwnedApplication(id, req.userId!);
    if (!current) {
      next(new AppError(404, 'not_found', 'application not found'));
      return;
    }
    const application: Application = {
      ...input,
      ...applyStatusChange(current.application, input, new Date()),
      interviews: normalizeInterviews(input.interviews),
      source: current.application.source,
    };
    const updated = await replaceOwnedApplication(current._id, req.userId!, version, application);
    if (updated) {
      // Notes autosave on every pause in typing; only an interview change needs booking.
      if (JSON.stringify(current.application.interviews) !== JSON.stringify(updated.application.interviews)) {
        await bookSoonReminders(req.userId!, updated._id, updated.application.interviews);
      }
      res.json(toRecord(updated));
      return;
    }
    const latest = await getOwnedApplication(current._id, req.userId!);
    if (!latest) {
      next(new AppError(404, 'not_found', 'application not found'));
      return;
    }
    res.status(409).json({
      code: 'version_conflict',
      message: `expected version ${version} but current version is ${latest.version}`,
      current: toRecord(latest),
    });
  } catch (err) {
    if (isDuplicateKey(err) && input.jobUrl) {
      await sendDuplicate(res, req.userId!, input.jobUrl).catch(next);
      return;
    }
    next(err);
  }
});

applicationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteOwnedApplication(req.params.id!, req.userId!);
    if (!deleted) {
      next(new AppError(404, 'not_found', 'application not found'));
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
