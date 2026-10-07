import { ApplicationInput, applyStatusChange, normalizeInterviews, type ChatActionState } from '@dossier/core';
import { deleteOwnedApplication, getOwnedApplication, replaceOwnedApplication } from '../db/applications.js';
import { getAction, moveAction, setPartState, type ChatActionDoc } from '../db/chat.js';
import { getSettings, savePrefs } from '../db/notifications.js';
import { bookSoonReminders } from '../notify/index.js';

export type ActionOutcome =
  | { ok: true; state: ChatActionState; changed: { applications: boolean; settings: boolean } }
  | { ok: false; code: 'not_found' | 'changed_since' | 'already_handled'; message: string };

const NOT_FOUND: ActionOutcome = { ok: false, code: 'not_found', message: 'that change is too old to undo or no longer exists' };
const HANDLED: ActionOutcome = { ok: false, code: 'already_handled', message: 'that was already handled' };

async function settle(doc: ChatActionDoc, from: ChatActionState, to: ChatActionState): Promise<boolean> {
  if (!(await moveAction(doc._id, doc.userId, from, to))) return false;
  await setPartState(doc.userId, doc.messageId, doc._id, to);
  return true;
}

// Undo puts back exactly what was there, but only if nothing else changed the application since:
// restoring over someone's newer edit would silently lose it.
export async function undoAction(userId: string, actionId: string): Promise<ActionOutcome> {
  const doc = await getAction(actionId, userId);
  if (!doc) return NOT_FOUND;
  if (doc.state !== 'done') return HANDLED;
  const target = doc.target;

  if (target.kind === 'settings') {
    const current = await getSettings(userId);
    // A channel disconnected since then stays off; Undo can't reconnect it.
    const enabled = target.before.enabled.filter((c) => (c === 'telegram' ? !!current?.telegram : !!current?.webpush?.length));
    if (!(await settle(doc, 'done', 'undone'))) return HANDLED;
    await savePrefs(userId, { ...target.before, enabled });
    return { ok: true, state: 'undone', changed: { applications: false, settings: true } };
  }
  if (target.kind !== 'application') return HANDLED;

  const current = await getOwnedApplication(target.applicationId, userId);
  if (!current) return { ok: false, code: 'changed_since', message: 'that application has been deleted' };
  if (current.version !== target.afterVersion) {
    return { ok: false, code: 'changed_since', message: "it has changed since, so I can't undo this safely" };
  }
  if (!(await settle(doc, 'done', 'undone'))) return HANDLED;

  if (!target.before) {
    await deleteOwnedApplication(target.applicationId, userId);
    return { ok: true, state: 'undone', changed: { applications: true, settings: false } };
  }
  const input = ApplicationInput.parse(target.before);
  // Through applyStatusChange, so the timeline records the stage going back and the board agrees.
  const restored = await replaceOwnedApplication(current._id, userId, current.version, {
    ...input,
    ...applyStatusChange(current.application, input, new Date()),
    interviews: normalizeInterviews(input.interviews),
    source: current.application.source,
  });
  if (!restored) {
    await settle(doc, 'undone', 'done');
    return { ok: false, code: 'changed_since', message: "it has changed since, so I can't undo this safely" };
  }
  await bookSoonReminders(userId, restored._id, restored.application.interviews);
  return { ok: true, state: 'undone', changed: { applications: true, settings: false } };
}

export async function confirmDelete(userId: string, actionId: string): Promise<ActionOutcome> {
  const doc = await getAction(actionId, userId);
  if (!doc || doc.target.kind !== 'delete') return NOT_FOUND;
  if (!(await settle(doc, 'awaiting_confirm', 'done'))) return HANDLED;
  await deleteOwnedApplication(doc.target.applicationId, userId);
  return { ok: true, state: 'done', changed: { applications: true, settings: false } };
}

export async function cancelAction(userId: string, actionId: string): Promise<ActionOutcome> {
  const doc = await getAction(actionId, userId);
  if (!doc) return NOT_FOUND;
  if (!(await settle(doc, 'awaiting_confirm', 'cancelled'))) return HANDLED;
  return { ok: true, state: 'cancelled', changed: { applications: false, settings: false } };
}
