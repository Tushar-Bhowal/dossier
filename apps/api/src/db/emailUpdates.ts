import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { EmailUpdateRecord, UpdateProposal } from '@dossier/core';
import { getDb } from './mongo.js';

export type UpdateSource = 'email' | 'assistant' | 'chat';

// Only the proposal is kept, never the email text. Deleted automatically after 30 days (TTL index).
interface EmailUpdateDoc {
  _id: string;
  userId: string;
  source?: UpdateSource; // missing on the first ones, which were all pasted emails
  state: 'pending' | 'applied' | 'dismissed';
  proposal: UpdateProposal;
  createdAt: Date;
}

async function collection(): Promise<Collection<EmailUpdateDoc>> {
  return (await getDb()).collection<EmailUpdateDoc>('emailUpdates');
}

export function toUpdateRecord(doc: EmailUpdateDoc): EmailUpdateRecord {
  return { id: doc._id, createdAt: doc.createdAt.toISOString(), proposal: doc.proposal };
}

export async function createEmailUpdate(userId: string, proposal: UpdateProposal, source: UpdateSource): Promise<EmailUpdateDoc> {
  const doc: EmailUpdateDoc = { _id: randomUUID(), userId, source, state: 'pending', proposal, createdAt: new Date() };
  await (await collection()).insertOne(doc);
  return doc;
}

export async function listPendingUpdates(userId: string): Promise<EmailUpdateDoc[]> {
  return (await collection()).find({ userId, state: 'pending' }).sort({ createdAt: -1 }).limit(50).toArray();
}

// Pasted emails cost an AI call each; assistant proposals don't, so each has its own daily limit.
// Proposals from chat are covered by the chat's own message limit.
export async function countUpdatesSince(userId: string, since: Date, source: UpdateSource): Promise<number> {
  const bySource = source === 'email' ? { source: { $nin: ['assistant', 'chat'] as UpdateSource[] } } : { source };
  return (await collection()).countDocuments({ userId, createdAt: { $gte: since }, ...bySource });
}

export async function getPendingUpdate(id: string, userId: string): Promise<EmailUpdateDoc | null> {
  return (await collection()).findOne({ _id: id, userId, state: 'pending' });
}

// Undoes the "applied" claim when applying failed, so the user can try again.
export async function reopenUpdate(id: string, userId: string): Promise<void> {
  await (await collection()).updateOne({ _id: id, userId, state: 'applied' }, { $set: { state: 'pending' } });
}

// Pending → applied/dismissed exactly once: a double tap can't apply the same update twice.
export async function settleUpdate(id: string, userId: string, state: 'applied' | 'dismissed'): Promise<boolean> {
  const result = await (await collection()).updateOne({ _id: id, userId, state: 'pending' }, { $set: { state } });
  return result.modifiedCount === 1;
}

export async function getUpdateStates(userId: string, ids: string[]): Promise<Map<string, EmailUpdateDoc['state']>> {
  const docs = await (await collection()).find({ userId, _id: { $in: ids } }, { projection: { state: 1 } }).toArray();
  return new Map(docs.map((d) => [d._id, d.state]));
}
