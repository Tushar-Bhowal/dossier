import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  ChatRequest,
  DEFAULT_PREFS,
  LlmCallError,
  isTimeZone,
  type ChatMessageView,
  type ChatPart,
  type ChatStreamEvent,
  type ChatTurn,
} from '@dossier/core';
import type { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { listOwnedApplications } from '../db/applications.js';
import { clearConversation, countUserMessagesSince, recentMessages, saveMessage, toMessageView, type ChatMessageDoc } from '../db/chat.js';
import { getUpdateStates, listPendingUpdates } from '../db/emailUpdates.js';
import { getSettings } from '../db/notifications.js';
import { executePlan, withoutAliases } from '../chat/executor.js';
import { planMessage } from '../chat/planner.js';
import { cancelAction, confirmDelete, undoAction, type ActionOutcome } from '../chat/undo.js';

// Each message is one AI call on a free-tier key shared by everyone.
const DAILY_MESSAGE_LIMIT = 60;
const HISTORY_TURNS = 8;
const HISTORY_PAGE = 50;

function attachmentLabel(text: string): string {
  return `Pasted text · ${text.length.toLocaleString('en-US')} characters`;
}

// What the AI sees of earlier turns: the words, plus what each reply changed ("Added Stripe …").
function toTurn(doc: ChatMessageDoc): ChatTurn {
  const done = doc.parts.flatMap((p) => (p.kind === 'done' ? [p.text] : []));
  const text = doc.attachmentLabel ? `${doc.text} [${doc.attachmentLabel}]` : doc.text;
  return { role: doc.role, text: done.length ? `${text} (${done.join('; ')})` : text };
}

// Proposal cards show whether they were applied or dismissed since, wherever that happened.
async function withProposalStates(userId: string, views: ChatMessageView[]): Promise<ChatMessageView[]> {
  const ids = views.flatMap((v) => v.parts.flatMap((p) => (p.kind === 'proposal' ? [p.update.id] : [])));
  if (!ids.length) return views;
  const states = await getUpdateStates(userId, ids);
  return views.map((v) => ({
    ...v,
    parts: v.parts.map((p): ChatPart => (p.kind === 'proposal' ? { ...p, state: states.get(p.update.id) ?? 'dismissed' } : p)),
  }));
}

export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.get('/', async (req, res, next) => {
  try {
    const views = (await recentMessages(req.userId!, HISTORY_PAGE)).map(toMessageView);
    res.json(await withProposalStates(req.userId!, views));
  } catch (err) {
    next(err);
  }
});

chatRouter.delete('/', async (req, res, next) => {
  try {
    await clearConversation(req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Streams newline-delimited JSON: progress steps while it works, then the stored reply. If the
// connection drops, the work still finishes and the client reloads the conversation.
chatRouter.post('/', validateBody(ChatRequest), async (req, res, next) => {
  const body = req.body as z.output<typeof ChatRequest>;
  const userId = req.userId!;
  const attachment = body.attachments[0]?.text;
  if (!body.text && !attachment) {
    next(new AppError(400, 'empty', 'type a message'));
    return;
  }
  try {
    if ((await countUserMessagesSince(userId, new Date(Date.now() - 86_400_000))) >= DAILY_MESSAGE_LIMIT) {
      next(new AppError(429, 'daily_limit', `you can send ${DAILY_MESSAGE_LIMIT} messages a day; try again tomorrow`));
      return;
    }
  } catch (err) {
    next(err);
    return;
  }

  res.status(200);
  res.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('x-accel-buffering', 'no');
  const send = (event: ChatStreamEvent) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };
  const step = (text: string) => send({ type: 'step', text });

  try {
    const now = new Date();
    const [settings, apps, history, pending] = await Promise.all([
      getSettings(userId),
      listOwnedApplications(userId),
      recentMessages(userId, HISTORY_TURNS),
      listPendingUpdates(userId),
    ]);
    // Until the user saves settings, the browser's time zone is the best guess for "tomorrow at 3".
    const prefs = settings?.prefs ?? {
      ...DEFAULT_PREFS,
      timezone: body.timezone && isTimeZone(body.timezone) ? body.timezone : DEFAULT_PREFS.timezone,
    };
    const channels = { telegramLinked: !!settings?.telegram, pushDevices: settings?.webpush?.length ?? 0 };

    const userDoc = await saveMessage(userId, {
      role: 'user',
      text: body.text,
      parts: [],
      attachmentLabel: attachment ? attachmentLabel(attachment) : undefined,
    });
    send({ type: 'user', message: toMessageView(userDoc) });

    const planned = await planMessage({
      text: body.text,
      attachment,
      page: body.page,
      prefs,
      channels,
      records: apps.map((a) => ({ id: a._id, application: a.application, updatedAt: a.updatedAt })),
      history: history.map(toTurn),
      now,
      step,
    });
    const messageId = randomUUID();
    const result = await executePlan({
      userId,
      messageId,
      now,
      prefs,
      channels,
      planned,
      origin: attachment ? 'attachment' : 'user',
      pageApplicationId: body.page.applicationId,
      attachment,
      pendingUpdates: pending.length,
      step,
    });
    const reply = await saveMessage(userId, { _id: messageId, role: 'assistant', text: withoutAliases(planned.plan.reply), parts: result.parts });
    send({ type: 'done', message: toMessageView(reply), changed: result.changed });
  } catch (err) {
    const aiDown = err instanceof LlmCallError;
    if (!aiDown) console.error('chat', err);
    send({
      type: 'error',
      code: aiDown ? 'ai_unavailable' : 'internal_error',
      message: aiDown ? "I couldn't do that right now. Try again in a minute, or do it by hand." : 'Something went wrong on our side. Try again.',
    });
  }
  res.end();
});

function sendOutcome(res: import('express').Response, outcome: ActionOutcome): void {
  if (outcome.ok) {
    res.json({ state: outcome.state, changed: outcome.changed });
    return;
  }
  res.status(outcome.code === 'not_found' ? 404 : 409).json({ code: outcome.code, message: outcome.message });
}

const ACTIONS = { undo: undoAction, confirm: confirmDelete, cancel: cancelAction } as const;

chatRouter.post('/actions/:id/:verb', async (req, res, next) => {
  const { id, verb } = req.params as { id: string; verb: string };
  const run = Object.hasOwn(ACTIONS, verb) ? ACTIONS[verb as keyof typeof ACTIONS] : undefined;
  if (!run || id.length > 64) {
    next(new AppError(404, 'not_found', 'unknown action'));
    return;
  }
  try {
    sendOutcome(res, await run(req.userId!, id));
  } catch (err) {
    next(err);
  }
});
