import type { Collection } from 'mongodb';
import { MongoServerError } from 'mongodb';
import type { RunRecord, RunStore } from '@dossier/core';
import { getDb } from './mongo.js';

export interface RunInput {
  jdText: string;
  companyUrl: string;
  daysAvailable: number;
}

// Mongo needs a document `_id`; RunRecord already carries its own string `id`, so the stored
// document is RunRecord plus `_id` mirroring `id` (never read back out as part of RunRecord).
type RunDoc = RunRecord & { _id: string; input?: RunInput };

async function collection(): Promise<Collection<RunDoc>> {
  const db = await getDb();
  return db.collection<RunDoc>('runs');
}

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof MongoServerError && err.code === 11000;
}

// Implements the shared `RunStore` port (so the durable step-runner in packages/core is unaware
// this is Mongo) plus two app-only helpers (`setInput`/`getInput`) that the batch CLI never needs
// — resuming a run over HTTP has no request body to resupply the original JD/company/days with,
// so the API persists them itself alongside the RunRecord fields the port actually defines.
export class MongoRunStore implements RunStore {
  async create(record: RunRecord): Promise<void> {
    const col = await collection();
    try {
      await col.insertOne({ ...record, _id: record.id });
    } catch (err) {
      // The unique { userId, idempotencyKey } index is what actually decides a duplicate
      // submission (§10) — this just gives the caller the same error shape InMemoryRunStore
      // throws, so callers don't need to special-case which store they're talking to.
      if (isDuplicateKeyError(err)) {
        throw new Error(
          `MongoRunStore: a run with idempotencyKey "${record.idempotencyKey}" already exists for this user`,
          { cause: err },
        );
      }
      throw err;
    }
  }

  async get(id: string): Promise<RunRecord | null> {
    const col = await collection();
    const doc = await col.findOne({ _id: id });
    if (!doc) return null;
    const { _id, input, ...record } = doc;
    void _id;
    void input;
    return record;
  }

  async findByIdempotencyKey(userId: string | null, idempotencyKey: string): Promise<RunRecord | null> {
    const col = await collection();
    const doc = await col.findOne({ userId, idempotencyKey });
    if (!doc) return null;
    const { _id, input, ...record } = doc;
    void _id;
    void input;
    return record;
  }

  async update(id: string, patch: Partial<Omit<RunRecord, 'id'>>): Promise<void> {
    const col = await collection();
    const result = await col.updateOne({ _id: id }, { $set: patch });
    if (result.matchedCount === 0) {
      throw new Error(`MongoRunStore: run "${id}" not found`);
    }
  }

  async setInput(id: string, input: RunInput): Promise<void> {
    const col = await collection();
    await col.updateOne({ _id: id }, { $set: { input } });
  }

  async getInput(id: string): Promise<RunInput | null> {
    const col = await collection();
    const doc = await col.findOne({ _id: id }, { projection: { input: 1 } });
    return doc?.input ?? null;
  }
}
