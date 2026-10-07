import { Router } from 'express';
import { z } from 'zod';
import {
  DEFAULT_PREFS,
  NotificationPrefs,
  PushSubscriptionInput,
  PushUnsubscribe,
  LEGACY_REMINDER_OFFSET,
  MAX_REMINDER_OFFSET,
  MIN_REMINDER_OFFSET,
  SWEEP_LOOKAHEAD_MS,
  digestMessage,
  isClosed,
  localDateIn,
  localHourIn,
  offsetsFor,
  offsetsSentence,
  reminderMessage,
  type NotificationSettingsView,
  type TestResult,
} from '@dossier/core';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { findWithInterviewsBetween, getOwnedApplication, listOwnedApplications } from '../db/applications.js';
import {
  addPushSub,
  claimSend,
  consumeLinkToken,
  createLinkToken,
  findDigestCandidates,
  getSettings,
  getSettingsMany,
  linkTelegram,
  releaseSend,
  removePushSub,
  savePrefs,
  unlinkTelegram,
  unlinkTelegramChat,
  type NotificationSettingsDoc,
} from '../db/notifications.js';
import { bookDueReminders, notifyUser, type DeliverPayload } from '../notify/index.js';
import { qstashConfigured, verifyQstash } from '../notify/qstash.js';
import { isTelegramSecret, sendTelegramText, telegramConfigured, telegramLinkUrl } from '../notify/telegram.js';
import { webpushConfigured } from '../notify/webpush.js';

function toView(doc: NotificationSettingsDoc | null): NotificationSettingsView {
  return {
    saved: Boolean(doc),
    prefs: doc?.prefs ?? DEFAULT_PREFS,
    telegram: doc?.telegram ? { linked: true, linkedAt: doc.telegram.linkedAt } : { linked: false },
    webpushDevices: (doc?.webpush ?? []).map((s) => s.endpoint),
    available: { telegram: telegramConfigured(), webpush: webpushConfigured(), reminders: qstashConfigured() },
    vapidPublicKey: webpushConfigured() ? process.env.VAPID_PUBLIC_KEY : undefined,
  };
}

// ---------- Called by the signed-in user ----------

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/settings', async (req, res, next) => {
  try {
    res.json(toView(await getSettings(req.userId!)));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.put('/settings', validateBody(NotificationPrefs), async (req, res, next) => {
  const prefs = req.body as NotificationPrefs;
  try {
    const current = await getSettings(req.userId!);
    // A channel can only be on once it's connected, whatever the client sends.
    const enabled = prefs.enabled.filter((c) => (c === 'telegram' ? !!current?.telegram : !!current?.webpush?.length));
    res.json(toView(await savePrefs(req.userId!, { ...prefs, enabled: [...new Set(enabled)] })));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/test', async (req, res, next) => {
  try {
    const doc = await getSettings(req.userId!);
    if (!doc?.prefs.enabled.length) {
      next(new AppError(400, 'no_channels', 'turn on a channel first'));
      return;
    }
    const outcomes = await notifyUser(doc, {
      title: 'Test from Dossier',
      body: doc.prefs.reminderOffsetsMin.length
        ? `Your interview reminders will arrive here, ${offsetsSentence(doc.prefs.reminderOffsetsMin)} each interview.`
        : 'Interview reminders are off; your morning summary will arrive here.',
      path: '/applications',
    });
    const results: TestResult[] = Object.entries(outcomes).map(([channel, outcome]) => ({
      channel: channel as TestResult['channel'],
      ok: outcome === 'sent',
    }));
    res.json(results);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/telegram/link', async (req, res, next) => {
  if (!telegramConfigured()) {
    next(new AppError(503, 'not_configured', 'Telegram is not set up on this server'));
    return;
  }
  try {
    res.json({ url: telegramLinkUrl(await createLinkToken(req.userId!)) });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete('/telegram', async (req, res, next) => {
  try {
    await unlinkTelegram(req.userId!);
    res.json(toView(await getSettings(req.userId!)));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/webpush', validateBody(PushSubscriptionInput), async (req, res, next) => {
  try {
    await addPushSub(req.userId!, req.body as PushSubscriptionInput);
    res.json(toView(await getSettings(req.userId!)));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/webpush/remove', validateBody(PushUnsubscribe), async (req, res, next) => {
  try {
    await removePushSub(req.userId!, (req.body as z.infer<typeof PushUnsubscribe>).endpoint);
    res.json(toView(await getSettings(req.userId!)));
  } catch (err) {
    next(err);
  }
});

// ---------- Called by Telegram and QStash, never by a browser ----------

export const notificationHooksRouter = Router();

interface TelegramUpdate {
  message?: { text?: string; chat?: { id?: number; type?: string } };
}

// Telegram POSTs every message sent to the bot here (registered once with setWebhook). Always answer
// 200: any error status makes Telegram resend the same update again and again.
notificationHooksRouter.post('/telegram/webhook', async (req, res) => {
  if (!isTelegramSecret(req.get('x-telegram-bot-api-secret-token'))) {
    res.status(401).end();
    return;
  }
  const message = (req.body as TelegramUpdate).message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim() ?? '';
  if (!chatId || message?.chat?.type !== 'private') {
    res.status(200).end();
    return;
  }
  try {
    const start = /^\/start(?:\s+([A-Za-z0-9_-]{1,64}))?$/.exec(text);
    if (start?.[1]) {
      const userId = await consumeLinkToken(start[1]);
      if (userId) {
        await linkTelegram(userId, chatId);
        await sendTelegramText(chatId, 'Connected. Dossier will send your interview reminders here. Send /stop any time to disconnect.');
      } else {
        await sendTelegramText(chatId, 'That link has expired. In Dossier, open Applications → Notifications and press Connect Telegram again.');
      }
    } else if (text === '/stop') {
      const count = await unlinkTelegramChat(chatId);
      await sendTelegramText(chatId, count ? 'Disconnected. You won’t get Dossier reminders here any more.' : 'This chat isn’t connected to Dossier.');
    } else {
      await sendTelegramText(chatId, 'I send interview reminders from Dossier. To connect, open Dossier → Applications → Notifications → Connect Telegram.');
    }
  } catch (err) {
    console.error('telegram webhook', err);
  }
  res.status(200).end();
});

// Messages booked before reminder times existed carry `kind` instead of `offsetMin`.
const DeliverBody = z
  .object({
    userId: z.string().min(1).max(100),
    applicationId: z.string().min(1).max(100),
    interviewId: z.string().min(1).max(64),
    offsetMin: z.int().min(MIN_REMINDER_OFFSET).max(MAX_REMINDER_OFFSET).optional(),
    kind: z.enum(['2h', '30m']).optional(),
    startsAt: z.string().max(40),
  })
  .transform(({ kind, offsetMin, ...rest }, ctx): DeliverPayload => {
    const offset = offsetMin ?? (kind ? LEGACY_REMINDER_OFFSET[kind] : undefined);
    if (offset === undefined) {
      ctx.addIssue({ code: 'custom', message: 'offsetMin is required' });
      return z.NEVER;
    }
    return { ...rest, offsetMin: offset };
  });

// QStash calls this at the reminder time. Everything is re-read from the database: an interview that
// was moved, deleted or closed since the message was booked is simply skipped. Answering 2xx tells
// QStash we're done; a 5xx makes it retry.
notificationHooksRouter.post('/deliver', verifyQstash, validateBody(DeliverBody), async (req, res, next) => {
  const p = req.body as DeliverPayload;
  try {
    const app = await getOwnedApplication(p.applicationId, p.userId);
    const interview = app?.application.interviews?.find((i) => i.id === p.interviewId);
    const doc = await getSettings(p.userId);
    if (!app || !interview || interview.startsAt !== p.startsAt) {
      res.json({ sent: false, reason: 'interview changed or removed' });
      return;
    }
    if (isClosed(app.application.status) || Date.now() > Date.parse(interview.startsAt)) {
      res.json({ sent: false, reason: 'application closed or interview started' });
      return;
    }
    // The reminder times may have changed since this message was booked.
    if (!doc?.prefs.enabled.length || !offsetsFor(doc.prefs.reminderOffsetsMin, interview).includes(p.offsetMin)) {
      res.json({ sent: false, reason: 'reminder turned off' });
      return;
    }

    const key = `${p.interviewId}:${p.offsetMin}:${p.startsAt}`;
    if (!(await claimSend(key))) {
      res.json({ sent: false, reason: 'already sent' });
      return;
    }

    const ttl = Math.max(60, Math.floor((Date.parse(interview.startsAt) - Date.now()) / 1000));
    const outcomes = Object.values(await notifyUser(doc, reminderMessage(app.application, interview, p.offsetMin, doc.prefs.timezone), ttl));
    if (!outcomes.includes('sent') && outcomes.includes('failed')) {
      // Nothing got through and it might next time: give the claim back and let QStash retry.
      await releaseSend(key);
      res.status(503).json({ sent: false, reason: 'channels failed' });
      return;
    }
    res.json({ sent: outcomes.includes('sent') });
  } catch (err) {
    next(err);
  }
});

// QStash calls this every hour (a QStash schedule, cron "0 * * * *"). It books the reminders due
// before the next sweep and sends morning summaries to users for whom it's now their summary hour.
notificationHooksRouter.post('/sweep', verifyQstash, async (_req, res, next) => {
  const now = new Date();
  try {
    // Reminders: interviews starting up to a day (the earliest possible reminder) after the window ends.
    const until = new Date(now.getTime() + SWEEP_LOOKAHEAD_MS).toISOString();
    const apps = (await findWithInterviewsBetween(now.toISOString(), until)).filter((a) => !isClosed(a.application.status));
    const settings = await getSettingsMany([...new Set(apps.map((a) => a.userId))]);
    let booked = 0;
    for (const app of apps) {
      const doc = settings.get(app.userId);
      if (doc) booked += await bookDueReminders(app.userId, app._id, app.application.interviews ?? [], doc.prefs, now);
    }

    let digests = 0;
    for (const doc of await findDigestCandidates()) {
      if (localHourIn(doc.prefs.timezone, now) !== doc.prefs.digestHour) continue;
      // One summary per local day, even if QStash runs this sweep twice.
      if (!(await claimSend(`digest:${doc._id}:${localDateIn(doc.prefs.timezone, now)}`))) continue;
      const message = digestMessage((await listOwnedApplications(doc._id)).map((a) => a.application), doc.prefs.timezone, now);
      if (message) {
        await notifyUser(doc, message, 6 * 3600);
        digests += 1;
      }
    }
    res.json({ booked, digests });
  } catch (err) {
    next(err);
  }
});
