import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Application, ApplicationRecord } from '@dossier/core';
import { getDb } from './mongo.js';

export interface ApplicationDoc {
  _id: string;
  userId: string;
  version: number;
  application: Application;
  createdAt: string;
  updatedAt: string;
}

async function collection(): Promise<Collection<ApplicationDoc>> {
  const db = await getDb();
  return db.collection<ApplicationDoc>('applications');
}

// The driver stores `undefined` as null, which would trip the unique jobUrl index and fail the
// schema on the next save. Optional fields are left out instead.
function compact(application: Application): Application {
  return Object.fromEntries(Object.entries(application).filter(([, v]) => v !== undefined)) as Application;
}

export function toRecord(doc: ApplicationDoc): ApplicationRecord {
  return { id: doc._id, version: doc.version, application: doc.application, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

export function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

export async function createApplication(userId: string, application: Application): Promise<ApplicationDoc> {
  const col = await collection();
  const now = new Date().toISOString();
  const doc: ApplicationDoc = { _id: randomUUID(), userId, version: 1, application: compact(application), createdAt: now, updatedAt: now };
  await col.insertOne(doc);
  return doc;
}

// Ownership is part of every filter, so another user's id reads as "not found".
export async function getOwnedApplication(id: string, userId: string): Promise<ApplicationDoc | null> {
  const col = await collection();
  return col.findOne({ _id: id, userId });
}

export async function findOwnedByJobUrl(userId: string, jobUrl: string): Promise<ApplicationDoc | null> {
  const col = await collection();
  return col.findOne({ userId, 'application.jobUrl': jobUrl });
}

export async function listOwnedApplications(userId: string): Promise<ApplicationDoc[]> {
  const col = await collection();
  return col.find({ userId }).sort({ updatedAt: -1 }).toArray();
}

// Start times are stored as UTC ISO strings (normalizeInterviews), so a string range is a time range.
export async function findWithInterviewsBetween(fromIso: string, toIso: string): Promise<ApplicationDoc[]> {
  const col = await collection();
  return col.find({ 'application.interviews': { $elemMatch: { startsAt: { $gte: fromIso, $lt: toIso } } } }).toArray();
}

// Compare-and-swap on version: null when the document is missing for this user or the version is stale.
export async function replaceOwnedApplication(
  id: string,
  userId: string,
  expectedVersion: number,
  application: Application,
): Promise<ApplicationDoc | null> {
  const col = await collection();
  return col.findOneAndUpdate(
    { _id: id, userId, version: expectedVersion },
    { $set: { application: compact(application), updatedAt: new Date().toISOString() }, $inc: { version: 1 } },
    { returnDocument: 'after' },
  );
}

export async function deleteOwnedApplication(id: string, userId: string): Promise<boolean> {
  const col = await collection();
  const result = await col.deleteOne({ _id: id, userId });
  return result.deletedCount === 1;
}
