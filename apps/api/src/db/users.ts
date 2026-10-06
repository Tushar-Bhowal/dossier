import type { Collection } from 'mongodb';
import { getDb } from './mongo.js';

// At least one way in is always set: a password, a Google account, or both.
export interface UserDoc {
  _id: string;
  email: string;
  passwordHash?: string;
  googleSub?: string;
  createdAt: string;
}

export async function users(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  return db.collection<UserDoc>('users');
}
