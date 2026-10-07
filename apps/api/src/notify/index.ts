import {
  SWEEP_WINDOW_MS,
  remindersBetween,
  type BuiltChannel,
  type Interview,
  type NotificationMessage,
  type NotificationPrefs,
  type ReminderKind,
} from '@dossier/core';
import { getSettings, removePushSub, unlinkTelegram, type NotificationSettingsDoc } from '../db/notifications.js';
import { publishAt, qstashConfigured } from './qstash.js';
import { sendTelegram, type SendOutcome } from './telegram.js';
import { sendPush } from './webpush.js';

type Sender = (doc: NotificationSettingsDoc, message: NotificationMessage, ttlSeconds: number) => Promise<SendOutcome | 'none'>;

// One adapter per channel behind the same signature. Callers say "notify this user"; adding a
// channel (email, WhatsApp) means adding one entry here, nothing else.
const SENDERS: Record<BuiltChannel, Sender> = {
  async telegram(doc, message) {
    if (!doc.telegram) return 'none';
    const outcome = await sendTelegram(doc.telegram.chatId, message);
    if (outcome === 'gone') await unlinkTelegram(doc._id);
    return outcome;
  },
  async webpush(doc, message, ttlSeconds) {
    const subs = doc.webpush ?? [];
    if (!subs.length) return 'none';
    const outcomes = await Promise.all(subs.map((sub) => sendPush(sub, message, ttlSeconds)));
    await Promise.all(subs.filter((_, i) => outcomes[i] === 'gone').map((sub) => removePushSub(doc._id, sub.endpoint)));
    if (outcomes.includes('sent')) return 'sent';
    return outcomes.includes('failed') ? 'failed' : 'gone';
  },
};

export async function notifyUser(
  doc: NotificationSettingsDoc,
  message: NotificationMessage,
  ttlSeconds = 3600,
): Promise<Partial<Record<BuiltChannel, SendOutcome | 'none'>>> {
  const channels = doc.prefs.enabled;
  const outcomes = await Promise.all(channels.map((channel) => SENDERS[channel](doc, message, ttlSeconds)));
  return Object.fromEntries(channels.map((channel, i) => [channel, outcomes[i]]));
}

export interface DeliverPayload {
  userId: string;
  applicationId: string;
  interviewId: string;
  kind: ReminderKind;
  startsAt: string;
}

export function reminderKinds(prefs: NotificationPrefs): ReminderKind[] {
  return [...(prefs.remind2h ? (['2h'] as const) : []), ...(prefs.remind30m ? (['30m'] as const) : [])];
}

// Books an exact-time QStash message for each reminder due before the next hourly sweep. Called by
// the sweep and right after an interview is saved; booking the same reminder twice is harmless.
export async function bookDueReminders(
  userId: string,
  applicationId: string,
  interviews: Interview[],
  prefs: NotificationPrefs,
  now: Date,
): Promise<number> {
  if (!qstashConfigured() || !prefs.enabled.length) return 0;
  const due = remindersBetween(interviews, reminderKinds(prefs), now.getTime(), now.getTime() + SWEEP_WINDOW_MS);
  await Promise.all(
    due.map(({ interview, kind, at }) => {
      const payload: DeliverPayload = { userId, applicationId, interviewId: interview.id, kind, startsAt: interview.startsAt };
      return publishAt('/notifications/deliver', payload, new Date(at));
    }),
  );
  return due.length;
}

// An interview saved less than an hour before its reminder would be missed by the hourly sweep, so
// it's booked now. Never throws: worst case the reminder is missing, the saved interview isn't.
export async function bookSoonReminders(userId: string, applicationId: string, interviews: Interview[] | undefined): Promise<void> {
  if (!interviews?.length) return;
  try {
    const doc = await getSettings(userId);
    if (doc) await bookDueReminders(userId, applicationId, interviews, doc.prefs, new Date());
  } catch (err) {
    console.error('booking reminders failed', err);
  }
}
