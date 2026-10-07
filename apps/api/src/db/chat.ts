import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Application, ChatActionState, ChatMessageView, ChatPart, NotificationPrefs } from '@dossier/core';
import { getDb } from './mongo.js';

// Pasted attachments are never stored, only their label. Deleted automatically after 30 days (TTL).
export interface ChatMessageDoc {
  _id: string;
  userId: string;
  role: 'user' | 'assistant';
  text: string;
  parts: ChatPart[];
  attachmentLabel?: string;
  createdAt: Date;
}

// What Undo needs: the state before the change and the version the change produced. Kept 7 days.
export type ChatActionTarget =
  | { kind: 'application'; applicationId: string; before: Application | null; afterVersion: number }
  | { kind: 'delete'; applicationId: string }
  | { kind: 'settings'; before: NotificationPrefs };

export interface ChatActionDoc {
  _id: string;
  userId: string;
  messageId: string;
  state: ChatActionState;
  target: ChatActionTarget;
  createdAt: Date;
}

async function messages(): Promise<Collection<ChatMessageDoc>> {
  return (await getDb()).collection<ChatMessageDoc>('chatMessages');
}

async function actions(): Promise<Collection<ChatActionDoc>> {
  return (await getDb()).collection<ChatActionDoc>('chatActions');
}

export function toMessageView(doc: ChatMessageDoc): ChatMessageView {
  return {
    id: doc._id,
    role: doc.role,
    text: doc.text,
    parts: doc.parts,
    attachmentLabel: doc.attachmentLabel,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function saveMessage(
  userId: string,
  message: Pick<ChatMessageDoc, 'role' | 'text' | 'parts' | 'attachmentLabel'> & { _id?: string },
): Promise<ChatMessageDoc> {
  const doc: ChatMessageDoc = {
    _id: message._id ?? randomUUID(),
    userId,
    role: message.role,
    text: message.text,
    parts: message.parts,
    createdAt: new Date(),
    ...(message.attachmentLabel ? { attachmentLabel: message.attachmentLabel } : {}),
  };
  await (await messages()).insertOne(doc);
  return doc;
}

// Newest `limit`, returned oldest first so they read top to bottom.
export async function recentMessages(userId: string, limit: number): Promise<ChatMessageDoc[]> {
  const docs = await (await messages()).find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.reverse();
}

export async function countUserMessagesSince(userId: string, since: Date): Promise<number> {
  return (await messages()).countDocuments({ userId, role: 'user', createdAt: { $gte: since } });
}

export async function clearConversation(userId: string): Promise<void> {
  await Promise.all([(await messages()).deleteMany({ userId }), (await actions()).deleteMany({ userId })]);
}

export async function saveAction(userId: string, messageId: string, state: ChatActionState, target: ChatActionTarget): Promise<string> {
  const doc: ChatActionDoc = { _id: randomUUID(), userId, messageId, state, target, createdAt: new Date() };
  await (await actions()).insertOne(doc);
  return doc._id;
}

export async function getAction(id: string, userId: string): Promise<ChatActionDoc | null> {
  return (await actions()).findOne({ _id: id, userId });
}

// from → to exactly once, so a double tap can't undo or confirm twice.
export async function moveAction(id: string, userId: string, from: ChatActionState, to: ChatActionState): Promise<boolean> {
  const result = await (await actions()).updateOne({ _id: id, userId, state: from }, { $set: { state: to } });
  return result.modifiedCount === 1;
}

// The card in the stored reply shows the action's current state when the conversation is reloaded.
export async function setPartState(userId: string, messageId: string, actionId: string, state: ChatActionState): Promise<void> {
  await (await messages()).updateOne(
    { _id: messageId, userId },
    { $set: { 'parts.$[p].state': state } },
    { arrayFilters: [{ 'p.actionId': actionId }] },
  );
}
