import { randomBytes } from 'node:crypto';
import type { Collection } from 'mongodb';
import { DEFAULT_PREFS, type BuiltChannel, type NotificationPrefs, type PushSubscriptionInput } from '@dossier/core';
import { getDb } from './mongo.js';
import { isDuplicateKey } from './applications.js';

export interface PushSub extends PushSubscriptionInput {
  createdAt: string;
}

export interface NotificationSettingsDoc {
  _id: string; // the user id: one settings document per user
  prefs: NotificationPrefs;
  telegram?: { chatId: number; linkedAt: string };
  webpush?: PushSub[];
  updatedAt: string;
}

interface TelegramLinkDoc {
  _id: string; // the one-time token in the t.me link
  userId: string;
  expiresAt: Date;
}

interface SentDoc {
  _id: string;
  createdAt: Date;
}

const MAX_PUSH_DEVICES = 5;
const LINK_TTL_MS = 15 * 60_000;

async function settings(): Promise<Collection<NotificationSettingsDoc>> {
  return (await getDb()).collection<NotificationSettingsDoc>('notificationSettings');
}

export async function getSettings(userId: string): Promise<NotificationSettingsDoc | null> {
  return (await settings()).findOne({ _id: userId });
}

export async function getSettingsMany(userIds: string[]): Promise<Map<string, NotificationSettingsDoc>> {
  const docs = await (await settings()).find({ _id: { $in: userIds } }).toArray();
  return new Map(docs.map((d) => [d._id, d]));
}

// Everyone who could get a morning summary; the hour is checked in code because it depends on
// each user's time zone.
export async function findDigestCandidates(): Promise<NotificationSettingsDoc[]> {
  return (await settings()).find({ 'prefs.digest': true, 'prefs.enabled.0': { $exists: true } }).toArray();
}

export async function savePrefs(userId: string, prefs: NotificationPrefs): Promise<NotificationSettingsDoc | null> {
  return (await settings()).findOneAndUpdate(
    { _id: userId },
    { $set: { prefs, updatedAt: new Date().toISOString() } },
    { upsert: true, returnDocument: 'after' },
  );
}

// $addToSet/$pull on prefs.enabled can't share an update with $setOnInsert of the whole prefs
// object, so a missing document is created first.
async function ensureDoc(userId: string): Promise<void> {
  await (await settings()).updateOne(
    { _id: userId },
    { $setOnInsert: { prefs: DEFAULT_PREFS, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
}

export async function linkTelegram(userId: string, chatId: number): Promise<void> {
  await ensureDoc(userId);
  await (await settings()).updateOne(
    { _id: userId },
    {
      $set: { telegram: { chatId, linkedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() },
      $addToSet: { 'prefs.enabled': 'telegram' },
    },
  );
}

export async function unlinkTelegram(userId: string): Promise<void> {
  await (await settings()).updateOne(
    { _id: userId },
    { $unset: { telegram: '' }, $pull: { 'prefs.enabled': 'telegram' }, $set: { updatedAt: new Date().toISOString() } },
  );
}

// "/stop" in Telegram knows only the chat, not the Dossier account.
export async function unlinkTelegramChat(chatId: number): Promise<number> {
  const result = await (await settings()).updateMany(
    { 'telegram.chatId': chatId },
    { $unset: { telegram: '' }, $pull: { 'prefs.enabled': 'telegram' }, $set: { updatedAt: new Date().toISOString() } },
  );
  return result.modifiedCount;
}

export async function addPushSub(userId: string, sub: PushSubscriptionInput): Promise<void> {
  await ensureDoc(userId);
  const col = await settings();
  // Same device subscribing again replaces its old entry; only the newest five devices are kept.
  await col.updateOne({ _id: userId }, { $pull: { webpush: { endpoint: sub.endpoint } } });
  await col.updateOne(
    { _id: userId },
    {
      $push: { webpush: { $each: [{ ...sub, createdAt: new Date().toISOString() }], $slice: -MAX_PUSH_DEVICES } },
      $addToSet: { 'prefs.enabled': 'webpush' },
      $set: { updatedAt: new Date().toISOString() },
    },
  );
}

export async function removePushSub(userId: string, endpoint: string): Promise<void> {
  const col = await settings();
  await col.updateOne({ _id: userId }, { $pull: { webpush: { endpoint } }, $set: { updatedAt: new Date().toISOString() } });
  // The last device gone means web push is off, not "on with nowhere to send".
  await col.updateOne({ _id: userId, 'webpush.0': { $exists: false } }, { $pull: { 'prefs.enabled': 'webpush' as BuiltChannel } });
}

async function telegramLinks(): Promise<Collection<TelegramLinkDoc>> {
  return (await getDb()).collection<TelegramLinkDoc>('telegramLinks');
}

// Random, single-use and short-lived: it proves the person pressing Start in Telegram is the person
// signed in to Dossier. base64url only uses characters Telegram allows in a start parameter.
export async function createLinkToken(userId: string): Promise<string> {
  const col = await telegramLinks();
  await col.deleteMany({ userId });
  const token = randomBytes(24).toString('base64url');
  await col.insertOne({ _id: token, userId, expiresAt: new Date(Date.now() + LINK_TTL_MS) });
  return token;
}

export async function consumeLinkToken(token: string): Promise<string | null> {
  const doc = await (await telegramLinks()).findOneAndDelete({ _id: token, expiresAt: { $gt: new Date() } });
  return doc?.userId ?? null;
}

async function sent(): Promise<Collection<SentDoc>> {
  return (await getDb()).collection<SentDoc>('sentReminders');
}

// The unique _id is the lock: the first caller inserts it and sends; a retry or a second booking of
// the same reminder hits the duplicate key and stops.
export async function claimSend(key: string): Promise<boolean> {
  try {
    await (await sent()).insertOne({ _id: key, createdAt: new Date() });
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

// Gives the claim back when nothing could be delivered, so QStash's retry gets another go.
export async function releaseSend(key: string): Promise<void> {
  await (await sent()).deleteOne({ _id: key });
}
