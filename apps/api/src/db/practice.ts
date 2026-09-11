import type { Collection } from 'mongodb';
import type { Confidence, LeitnerBox } from '@dossier/core';
import { getDb } from './mongo.js';

export interface CardState {
  box: LeitnerBox;
  dueAt: string;
  lastConfidence: Confidence;
  reviewedAt: string;
}

export interface PracticeDoc {
  _id: string;
  userId: string;
  cards: Record<string, CardState>;
  updatedAt: string;
}

async function collection(): Promise<Collection<PracticeDoc>> {
  const db = await getDb();
  return db.collection<PracticeDoc>('practice');
}

export async function getPracticeDoc(kitId: string, userId: string): Promise<PracticeDoc | null> {
  const col = await collection();
  return col.findOne({ _id: kitId, userId });
}

// Two concurrent first-ever reviews on the same kit can both miss the doc and race the upsert —
// Mongo lets exactly one insert win and throws E11000 (code 11000) on the other. That loser just
// retries as a plain update: the doc now exists, so this always succeeds.
export async function saveCardState(kitId: string, userId: string, flashcardId: string, state: CardState): Promise<void> {
  const col = await collection();
  const update = { $set: { [`cards.${flashcardId}`]: state, updatedAt: new Date().toISOString() } };
  try {
    await col.updateOne({ _id: kitId, userId }, update, { upsert: true });
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 11000) {
      await col.updateOne({ _id: kitId, userId }, update);
      return;
    }
    throw err;
  }
}
