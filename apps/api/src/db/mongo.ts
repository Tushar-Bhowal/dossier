import { MongoClient, type Db } from 'mongodb';

// Cached across invocations at module scope so Fluid Compute reuse avoids a reconnect per
// request. A single promise (not a resolved client) so concurrent cold-start callers await the
// same in-flight connection instead of racing to open several.
let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is required (see .env.example)');
    }
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
  await db.collection('runs').createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true });
  await db.collection('kits').createIndex({ userId: 1 });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
}

let indexesReady: Promise<void> | null = null;

// Indexes are created lazily on first use rather than requiring a separate deploy step — both
// local `next dev` and a cold serverless invocation just work, and the promise is cached so
// concurrent requests don't all race to create the same index.
export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db(process.env.MONGODB_DB ?? 'dossier');
  if (!indexesReady) {
    indexesReady = ensureIndexes(db);
  }
  await indexesReady;
  return db;
}
