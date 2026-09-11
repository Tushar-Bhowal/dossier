import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Kit } from '@dossier/core';
import { getDb } from './mongo.js';

export interface KitInput {
  jdText: string;
  companyUrl: string;
  daysAvailable: number;
}

export interface KitDoc {
  _id: string;
  userId: string;
  version: number;
  kit: Kit;
  // The pasted JD and company URL that produced this kit — not part of the Appendix A contract,
  // kept alongside it purely so a later section regeneration (Task 23) has something to
  // re-extract/re-crawl from without asking the user to re-paste the JD.
  input: KitInput;
  createdAt: string;
  updatedAt: string;
}

async function collection(): Promise<Collection<KitDoc>> {
  const db = await getDb();
  return db.collection<KitDoc>('kits');
}

export async function createKit(userId: string, kit: Kit, input: KitInput): Promise<KitDoc> {
  const col = await collection();
  const now = new Date().toISOString();
  const doc: KitDoc = { _id: randomUUID(), userId, version: 1, kit, input, createdAt: now, updatedAt: now };
  await col.insertOne(doc);
  return doc;
}

// Ownership is enforced in the query filter, not a post-fetch check — a mismatched userId comes
// back as "not found", never as someone else's document.
export async function getOwnedKit(id: string, userId: string): Promise<KitDoc | null> {
  const col = await collection();
  return col.findOne({ _id: id, userId });
}

export async function listOwnedKits(userId: string): Promise<KitDoc[]> {
  const col = await collection();
  return col.find({ userId }).sort({ updatedAt: -1 }).toArray();
}

// Atomic compare-and-swap on `version` — the database decides the conflict, not a read-then-write
// race. Returns null when either the document doesn't exist for this user or `expectedVersion` is
// stale; the caller distinguishes the two with a follow-up getOwnedKit to build a 404 vs 409.
export async function replaceOwnedKit(id: string, userId: string, expectedVersion: number, kit: Kit): Promise<KitDoc | null> {
  const col = await collection();
  const result = await col.findOneAndUpdate(
    { _id: id, userId, version: expectedVersion },
    { $set: { kit, updatedAt: new Date().toISOString() }, $inc: { version: 1 } },
    { returnDocument: 'after' },
  );
  return result;
}

export async function deleteOwnedKit(id: string, userId: string): Promise<boolean> {
  const col = await collection();
  const result = await col.deleteOne({ _id: id, userId });
  return result.deletedCount === 1;
}
