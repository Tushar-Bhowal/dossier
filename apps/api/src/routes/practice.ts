import { Router } from 'express';
import { z } from 'zod';
import { nextBox, nextReviewInDays, type Flashcard, type LeitnerBox } from '@dossier/core';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getOwnedKit } from '../db/kits.js';
import { getPracticeDoc, saveCardState, type CardState } from '../db/practice.js';

export const practiceRouter = Router();

practiceRouter.use(requireAuth);

const DEFAULT_BOX: LeitnerBox = 1;

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Pure so it's directly unit-testable: given the kit's creation time and how many days the user
// asked for, how many whole days are left before the interview, as of `now`.
export function daysRemaining(kitCreatedAt: string, daysAvailable: number, now: Date): number {
  const deadline = new Date(kitCreatedAt);
  deadline.setUTCDate(deadline.getUTCDate() + daysAvailable);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((deadline.getTime() - now.getTime()) / msPerDay);
}

export function addDays(dateOnly: string, offset: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return toDateOnly(date);
}

export interface PracticeCardView {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  box: LeitnerBox;
  dueAt: string;
  due: boolean;
  covered: boolean;
  lastConfidence: CardState['lastConfidence'] | null;
  reviewedAt: string | null;
}

// Pure: takes the kit's flashcards and whatever per-card state exists, and produces the
// due/covered-annotated, weakest-first-sorted session view — no I/O, so this is the part unit
// tests exercise directly rather than through a live Mongo-backed route.
export function annotateSession(
  flashcards: Flashcard[],
  cardStates: Record<string, CardState> | undefined,
  today: string,
): PracticeCardView[] {
  return flashcards
    .map((f) => {
      const state = cardStates?.[f.id];
      const box = state?.box ?? DEFAULT_BOX;
      const dueAt = state?.dueAt ?? today;
      return {
        id: f.id,
        front: f.front,
        back: f.back,
        requirement_ids: f.requirement_ids,
        box,
        dueAt,
        due: dueAt <= today,
        covered: state !== undefined,
        lastConfidence: state?.lastConfidence ?? null,
        reviewedAt: state?.reviewedAt ?? null,
      };
    })
    .sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1;
      if (a.box !== b.box) return a.box - b.box;
      return a.dueAt.localeCompare(b.dueAt);
    });
}

async function buildSession(kitId: string, userId: string) {
  const kitDoc = await getOwnedKit(kitId, userId);
  if (!kitDoc) {
    return null;
  }

  const remaining = daysRemaining(kitDoc.createdAt, kitDoc.kit.schedule.days_available, new Date());
  const today = toDateOnly(new Date());
  const practiceDoc = await getPracticeDoc(kitId, userId);
  const cards = annotateSession(kitDoc.kit.flashcards, practiceDoc?.cards, today);

  return { daysRemaining: Math.max(remaining, 0), cards };
}

practiceRouter.get('/:id/practice', async (req, res, next) => {
  try {
    const session = await buildSession(req.params.id!, req.userId!);
    if (!session) {
      next(new AppError(404, 'not_found', 'kit not found'));
      return;
    }
    res.json(session);
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  flashcardId: z.string().regex(/^f\d+$/),
  confidence: z.enum(['low', 'medium', 'high']),
});

practiceRouter.post('/:id/practice', async (req, res, next) => {
  try {
    const kitId = req.params.id!;
    const userId = req.userId!;

    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new AppError(400, 'validation_error', parsed.error.message));
      return;
    }
    const { flashcardId, confidence } = parsed.data;

    const kitDoc = await getOwnedKit(kitId, userId);
    if (!kitDoc) {
      next(new AppError(404, 'not_found', 'kit not found'));
      return;
    }
    if (!kitDoc.kit.flashcards.some((f) => f.id === flashcardId)) {
      next(new AppError(400, 'validation_error', `flashcard "${flashcardId}" does not belong to this kit`));
      return;
    }

    const practiceDoc = await getPracticeDoc(kitId, userId);
    const currentBox = practiceDoc?.cards[flashcardId]?.box ?? DEFAULT_BOX;
    const newBox = nextBox(currentBox, confidence);
    const remaining = daysRemaining(kitDoc.createdAt, kitDoc.kit.schedule.days_available, new Date());
    const offset = nextReviewInDays(newBox, remaining);
    const today = toDateOnly(new Date());

    const state: CardState = {
      box: newBox,
      dueAt: addDays(today, offset),
      lastConfidence: confidence,
      reviewedAt: new Date().toISOString(),
    };
    await saveCardState(kitId, userId, flashcardId, state);

    const session = await buildSession(kitId, userId);
    res.json(session);
  } catch (err) {
    next(err);
  }
});
