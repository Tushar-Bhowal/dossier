import { Router } from 'express';
import { Kit } from '@dossier/core';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getOwnedKit, listOwnedKits, replaceOwnedKit, deleteOwnedKit } from '../db/kits.js';

export const kitsRouter = Router();

kitsRouter.use(requireAuth);

kitsRouter.get('/', async (req, res, next) => {
  try {
    const docs = await listOwnedKits(req.userId!);
    res.json(docs.map((d) => ({ id: d._id, version: d.version, kit: d.kit, createdAt: d.createdAt, updatedAt: d.updatedAt })));
  } catch (err) {
    next(err);
  }
});

kitsRouter.get('/:id', async (req, res, next) => {
  try {
    const doc = await getOwnedKit(req.params.id!, req.userId!);
    if (!doc) {
      next(new AppError(404, 'not_found', 'kit not found'));
      return;
    }
    res.json({ id: doc._id, version: doc.version, kit: doc.kit, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
  } catch (err) {
    next(err);
  }
});

// Optimistic concurrency: the client must send the version it read, either as `If-Match` (the
// conventional header for this) or a `version` field in the body. A mismatch is a 409 carrying
// the current document so the client can rebase the in-flight edit (§13's edit-in-flight case) —
// never a silent last-write-wins overwrite.
kitsRouter.patch('/:id', async (req, res, next) => {
  try {
    const ifMatch = req.get('If-Match');
    const bodyVersion = typeof req.body?.version === 'number' ? req.body.version : undefined;
    const expectedVersion = ifMatch !== undefined ? Number(ifMatch) : bodyVersion;
    if (expectedVersion === undefined || !Number.isInteger(expectedVersion)) {
      next(new AppError(400, 'validation_error', 'a version must be supplied via If-Match header or body.version'));
      return;
    }

    const parsed = Kit.safeParse(req.body?.kit);
    if (!parsed.success) {
      next(new AppError(400, 'validation_error', parsed.error.message));
      return;
    }

    const updated = await replaceOwnedKit(req.params.id!, req.userId!, expectedVersion, parsed.data);
    if (updated) {
      res.json({ id: updated._id, version: updated.version, kit: updated.kit, updatedAt: updated.updatedAt });
      return;
    }

    const current = await getOwnedKit(req.params.id!, req.userId!);
    if (!current) {
      next(new AppError(404, 'not_found', 'kit not found'));
      return;
    }
    res.status(409).json({
      code: 'version_conflict',
      message: `expected version ${expectedVersion} but current version is ${current.version}`,
      current: { id: current._id, version: current.version, kit: current.kit, updatedAt: current.updatedAt },
    });
  } catch (err) {
    next(err);
  }
});

kitsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteOwnedKit(req.params.id!, req.userId!);
    if (!deleted) {
      next(new AppError(404, 'not_found', 'kit not found'));
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
