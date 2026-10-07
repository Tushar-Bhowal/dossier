import { randomUUID } from 'node:crypto';
import {
  ApplicationInput,
  Interview,
  SWEEP_LOOKAHEAD_MS,
  applyStatusChange,
  followUpsAnswer,
  formatWhen,
  listAnswer,
  newApplication,
  normalizeInterviews,
  offsetsSentence,
  quietAnswer,
  stageText,
  statusAnswer,
  todayAnswer,
  upcomingAnswer,
  updatedApplication,
  updatedPrefs,
  upcomingInterviews,
  withInterview,
  withInterviewChanged,
  withNote,
  withoutInterview,
  zonedTimeToUtc,
  type AliasedRecord,
  type Application,
  type ApplicationPreview,
  type ApplyContext,
  type ChatAction,
  type ChatFallback,
  type ChatPart,
  type NotificationPrefs,
  type UpdateProposal,
} from '@dossier/core';
import { createApplication, getOwnedApplication, isDuplicateKey, replaceOwnedApplication, type ApplicationDoc } from '../db/applications.js';
import { saveAction } from '../db/chat.js';
import { createEmailUpdate, toUpdateRecord } from '../db/emailUpdates.js';
import { savePrefs } from '../db/notifications.js';
import { bookSoonReminders } from '../notify/index.js';
import { telegramConfigured } from '../notify/telegram.js';
import { webpushConfigured } from '../notify/webpush.js';
import type { ChannelState, Planned } from './planner.js';

const MAX_ACTIONS = 8;
const MAX_OPTIONS = 5;

export interface ExecInput {
  userId: string;
  messageId: string;
  now: Date;
  prefs: NotificationPrefs;
  channels: ChannelState;
  planned: Planned;
  // A pasted attachment is someone else's words: everything it leads to becomes a proposal.
  origin: 'user' | 'attachment';
  pageApplicationId?: string;
  // The pasted text itself, used only as the job description when the user asks for a kit from it.
  attachment?: string;
  pendingUpdates: number;
  step: (text: string) => void;
}

export interface ExecResult {
  parts: ChatPart[];
  changed: { applications: boolean; settings: boolean };
}

class ActionError extends Error {}

type Mutation = (input: ApplicationInput, app: Application) => ApplicationInput;

interface Draft {
  row: AliasedRecord;
  mutations: Mutation[];
}

interface NewDraft {
  alias: string;
  input: ApplicationInput;
  page?: ApplicationPreview;
  mutations: Mutation[];
}

function errorPart(text: string, fallback?: ChatFallback): ChatPart {
  return { kind: 'error', text, fallback };
}

function label(app: Pick<Application, 'company' | 'role'>): string {
  return `${app.company} · ${app.role}`;
}

// One line for everything a message changed on one application: "Stripe · Interviewing, round 2 · interview Thu 9 Oct, 4:00 pm".
function describeChange(before: Application, after: Application, timeZone: string): string {
  const changes: string[] = [];
  if (before.status !== after.status || before.round !== after.round) changes.push(stageText(after));
  const beforeIds = new Map((before.interviews ?? []).map((i) => [i.id, i]));
  const afterIds = new Map((after.interviews ?? []).map((i) => [i.id, i]));
  for (const i of after.interviews ?? []) {
    const old = beforeIds.get(i.id);
    if (!old) changes.push(`interview ${formatWhen(i.startsAt, timeZone)}`);
    else if (old.startsAt !== i.startsAt) changes.push(`interview moved to ${formatWhen(i.startsAt, timeZone)}`);
    else if (JSON.stringify(old.reminderOffsetsMin) !== JSON.stringify(i.reminderOffsetsMin)) {
      changes.push(`reminders for that interview: ${offsetsSentence(i.reminderOffsetsMin ?? [])}`);
    } else if (JSON.stringify(old) !== JSON.stringify(i)) changes.push('interview details updated');
  }
  if ([...beforeIds.keys()].some((id) => !afterIds.has(id))) changes.push('interview removed');
  if (before.followUpOn !== after.followUpOn) changes.push(after.followUpOn ? `follow-up ${after.followUpOn}` : 'follow-up removed');
  if (before.notes !== after.notes) changes.push('note added');
  if (before.company !== after.company || before.role !== after.role || before.location !== after.location || before.jobUrl !== after.jobUrl) {
    changes.push('details updated');
  }
  return [after.company, ...changes].join(' · ');
}

function toApplication(prev: Application | null, next: ApplicationInput, now: Date, source: Application['source']): Application {
  const parsed = ApplicationInput.safeParse(next);
  if (!parsed.success) throw new ActionError(`some details didn't fit (${parsed.error.issues[0]?.path.join('.') || 'value'})`);
  return {
    ...parsed.data,
    ...applyStatusChange(prev, parsed.data, now),
    interviews: normalizeInterviews(parsed.data.interviews),
    source,
  };
}

// Retried once on a version clash: the user may be editing the same application in another tab.
async function saveMutations(userId: string, id: string, mutations: Mutation[], now: Date): Promise<{ before: ApplicationDoc; after: ApplicationDoc } | 'unchanged'> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await getOwnedApplication(id, userId);
    if (!current) throw new ActionError('that application no longer exists');
    const input = mutations.reduce((acc, m) => m(acc, current.application), ApplicationInput.parse(current.application));
    const application = toApplication(current.application, input, now, current.application.source);
    if (JSON.stringify(application) === JSON.stringify(current.application)) return 'unchanged';
    const updated = await replaceOwnedApplication(id, userId, current.version, application);
    if (updated) return { before: current, after: updated };
  }
  throw new ActionError('it kept changing in another tab; try again');
}

function interviewAt(app: Application, n: number | undefined, now: Date): Interview {
  const list = upcomingInterviews(app, now);
  const interview = list[(n ?? 1) - 1];
  if (!interview) throw new ActionError(list.length ? `there is no interview #${n}` : 'there is no upcoming interview');
  return interview;
}

export async function executePlan(input: ExecInput): Promise<ExecResult> {
  const { planned, now, userId } = input;
  const tz = input.prefs.timezone;
  const actions = withTypedLinks(withoutGuessedTimes(planned.plan), planned.meetingLinks, planned.jobLinks);
  const rows = [...planned.rows];
  const ctx: ApplyContext = { now, timeZone: tz, links: planned.links, newId: randomUUID };
  const parts: ChatPart[] = [];
  const changed = { applications: false, settings: false };

  // The AI names a new application by the next free alias, so creates get aliases in order.
  const created = new Map<string, NewDraft>();
  let nextAlias = rows.length + 1;
  const drafts = new Map<string, Draft>();
  const rowFor = (ref: string | undefined) => (ref ? rows.find((r) => r.alias === ref) : undefined);
  const pageRow = () => rows.find((r) => r.id === input.pageApplicationId);

  if (input.origin === 'attachment') return proposalsFromAttachment(input, actions, rows, ctx);

  // Pass 1: gather every change to an application, so one message makes one save (and one Undo) per application.
  const later: ChatAction[] = [];
  for (const action of actions) {
    if (action.type === 'create_application') {
      const alias = `A${nextAlias++}`;
      const page = action.link ? planned.pages.get(action.link.trim()) : undefined;
      const fresh = newApplication(action, ctx);
      created.set(alias, {
        alias,
        page,
        mutations: [],
        input: {
          ...fresh,
          company: fresh.company || page?.company || 'Unknown company',
          role: fresh.role === 'Role not stated' && page?.role ? page.role : fresh.role,
          jdText: page?.jdText,
          companyUrl: page?.companyUrl,
        },
      });
      continue;
    }
    const mutation = mutationFor(action, ctx, now);
    if (!mutation) {
      later.push(action);
      continue;
    }
    const ref = 'ref' in action ? action.ref : undefined;
    const fresh = ref ? created.get(ref) : undefined;
    if (fresh) {
      fresh.mutations.push(mutation);
      continue;
    }
    const row = rowFor(ref);
    if (!row) {
      parts.push(errorPart("I couldn't tell which application you meant. Say the company name and I'll try again."));
      continue;
    }
    const draft = drafts.get(row.id) ?? { row, mutations: [] };
    draft.mutations.push(mutation);
    drafts.set(row.id, draft);
  }

  for (const fresh of created.values()) {
    input.step(`Adding ${fresh.input.company}`);
    try {
      const nextInput = fresh.mutations.reduce((acc, m) => m(acc, acc as Application), fresh.input);
      const doc = await createApplication(userId, toApplication(null, nextInput, now, 'manual'));
      rows.push({ id: doc._id, application: doc.application, updatedAt: doc.updatedAt, alias: fresh.alias });
      const actionId = await saveAction(userId, input.messageId, 'done', { kind: 'application', applicationId: doc._id, before: null, afterVersion: doc.version });
      await bookSoonReminders(userId, doc._id, doc.application.interviews);
      const interview = doc.application.interviews?.[0];
      parts.push({
        kind: 'done',
        actionId,
        applicationId: doc._id,
        state: 'done',
        text: `Added ${label(doc.application)} · ${stageText(doc.application)}${interview ? ` · interview ${formatWhen(interview.startsAt, tz)}` : ''}`,
      });
      changed.applications = true;
    } catch (err) {
      if (isDuplicateKey(err)) parts.push(errorPart(`That job link is already in your tracker.`));
      else if (err instanceof ActionError) parts.push(errorPart(`I couldn't add ${fresh.input.company}: ${err.message}.`, { form: 'add_application' }));
      else throw err;
    }
  }

  for (const draft of drafts.values()) {
    input.step(`Updating ${draft.row.application.company}`);
    try {
      const result = await saveMutations(userId, draft.row.id, draft.mutations, now);
      if (result === 'unchanged') {
        parts.push({ kind: 'done', applicationId: draft.row.id, state: 'done', text: `${draft.row.application.company} was already up to date` });
        continue;
      }
      const { before, after } = result;
      const idx = rows.findIndex((r) => r.id === after._id);
      if (idx >= 0) rows[idx] = { ...rows[idx]!, application: after.application, updatedAt: after.updatedAt };
      const actionId = await saveAction(userId, input.messageId, 'done', {
        kind: 'application',
        applicationId: after._id,
        before: before.application,
        afterVersion: after.version,
      });
      if (JSON.stringify(before.application.interviews) !== JSON.stringify(after.application.interviews)) {
        await bookSoonReminders(userId, after._id, after.application.interviews);
      }
      parts.push({ kind: 'done', actionId, applicationId: after._id, state: 'done', text: describeChange(before.application, after.application, tz) });
      changed.applications = true;
    } catch (err) {
      if (isDuplicateKey(err)) parts.push(errorPart('That job link is already on another application.'));
      else if (err instanceof ActionError) {
        parts.push(errorPart(`I couldn't update ${draft.row.application.company}: ${err.message}.`, { form: 'edit_application', applicationId: draft.row.id }));
      } else throw err;
    }
  }

  // Pass 2: everything that isn't an edit to an application, now that new applications have ids.
  let prefs = input.prefs;
  const comingSoon = new Set<string>();
  for (const action of later) {
    switch (action.type) {
      case 'delete_application': {
        const row = rowFor(action.ref);
        if (!row) {
          parts.push(errorPart("I couldn't tell which application to delete."));
          break;
        }
        const actionId = await saveAction(userId, input.messageId, 'awaiting_confirm', { kind: 'delete', applicationId: row.id });
        parts.push({ kind: 'confirm_delete', actionId, applicationId: row.id, label: label(row.application), state: 'awaiting_confirm' });
        break;
      }
      case 'set_reminders': {
        const next = updatedPrefs(prefs, action);
        if (!next) {
          parts.push({ kind: 'done', state: 'done', text: 'Your reminder settings already match that' });
          break;
        }
        parts.push(await saveSettings(input, prefs, next, settingsText(prefs, next)));
        // A new time can fall before the next hourly sweep ("10 minutes before" an interview at 3:30).
        if (JSON.stringify(prefs.reminderOffsetsMin) !== JSON.stringify(next.reminderOffsetsMin)) {
          const soon = rows.filter((r) => upcomingInterviews(r.application, now).some((i) => Date.parse(i.startsAt) < now.getTime() + SWEEP_LOOKAHEAD_MS));
          await Promise.all(soon.map((r) => bookSoonReminders(userId, r.id, r.application.interviews)));
        }
        prefs = next;
        changed.settings = true;
        break;
      }
      case 'set_channel': {
        const result = await channelChange(input, prefs, action.channel, action.on, comingSoon);
        if (result.part) parts.push(result.part);
        if (result.prefs) {
          prefs = result.prefs;
          changed.settings = true;
        }
        break;
      }
      case 'show': {
        const row = rowFor(action.ref) ?? pageRow();
        if (action.widget === 'connect_telegram') {
          const result = await channelChange(input, prefs, 'telegram', true, comingSoon);
          if (result.part) parts.push(result.part);
          if (result.prefs) {
            prefs = result.prefs;
            changed.settings = true;
          }
          break;
        }
        if (action.widget === 'resume_studio') {
          parts.push({ kind: 'coming_soon', text: 'Resume help in chat is coming soon. You can look around Resume Studio today.', path: '/resumes' });
          break;
        }
        if (action.widget === 'enable_push') {
          parts.push(webpushConfigured() ? { kind: 'enable_push' } : { kind: 'coming_soon', text: 'Browser notifications aren’t set up on this server yet.' });
          break;
        }
        if (!row) {
          parts.push(errorPart('Which application do you mean? Say the company name.'));
          break;
        }
        if (action.widget === 'open_application') parts.push({ kind: 'open_application', applicationId: row.id, label: label(row.application) });
        if (action.widget === 'make_kit') parts.push({ kind: 'make_kit', applicationId: row.id, label: label(row.application) });
        if (action.widget === 'calendar') {
          try {
            const interview = interviewAt(row.application, action.interview, now);
            parts.push({
              kind: 'calendar',
              applicationId: row.id,
              interviewId: interview.id,
              label: `${row.application.company}${interview.round ? ` · round ${interview.round}` : ''} · ${formatWhen(interview.startsAt, tz)}`,
            });
          } catch (err) {
            if (!(err instanceof ActionError)) throw err;
            parts.push(errorPart(`${row.application.company}: ${err.message}.`));
          }
        }
        break;
      }
      case 'answer': {
        const records = rows;
        if (action.about === 'today') parts.push(todayAnswer(records, input.pendingUpdates, tz, now));
        if (action.about === 'upcoming') parts.push(upcomingAnswer(records, tz, now));
        if (action.about === 'follow_ups') parts.push(followUpsAnswer(records, now));
        if (action.about === 'quiet') parts.push(quietAnswer(records, now));
        if (action.about === 'list') parts.push(listAnswer(records, action.stage));
        if (action.about === 'status') {
          const row = rowFor(action.ref) ?? pageRow();
          parts.push(row ? statusAnswer(row, tz, now) : errorPart('Which application do you mean? Say the company name.'));
        }
        break;
      }
      default:
        break;
    }
  }

  const question = planned.plan.question;
  if (question && question.options.length >= 2) {
    parts.push({ kind: 'choices', text: withoutAliases(question.text), options: question.options.slice(0, MAX_OPTIONS).map(withoutAliases) });
  }
  return { parts, changed };
}

// Asking "what time?" while also booking the interview at midnight is a guess, not the user's words.
function withoutGuessedTimes(plan: Planned['plan']): ChatAction[] {
  const actions = plan.actions.slice(0, MAX_ACTIONS);
  if (!plan.question) return actions;
  return actions.filter((a) => !((a.type === 'add_interview' || a.type === 'update_interview') && a.start?.endsWith('T00:00')));
}

// The model sometimes leaves out a link the user typed (C0 and C9 both caught it). One typed meeting
// link and one new interview without a link can only belong together; same for a job link and a new application.
function withTypedLinks(actions: ChatAction[], meetingLinks: string[], jobLinks: string[]): ChatAction[] {
  const interviews = actions.filter((a) => a.type === 'add_interview');
  const creates = actions.filter((a) => a.type === 'create_application');
  const meeting = meetingLinks.length === 1 && interviews.length === 1 && !interviews[0]!.link ? meetingLinks[0] : undefined;
  const job = jobLinks.length === 1 && creates.length === 1 && !creates[0]!.link ? jobLinks[0] : undefined;
  return actions.map((a) => {
    if (a.type === 'add_interview' && meeting) return { ...a, link: meeting };
    if (a.type === 'create_application' && job) return { ...a, link: job };
    return a;
  });
}

// Aliases are for the model; a button saying "Stripe · Frontend Engineer (A1)" would leak them.
export function withoutAliases(text: string): string {
  return text.replace(/\s*[([]?\bA\d{1,3}\b[)\]]?/g, '').trim();
}

// Edits to an application, as functions of its current state; null for everything else.
function mutationFor(action: ChatAction, ctx: ApplyContext, now: Date): Mutation | null {
  switch (action.type) {
    case 'update_application':
      return (input) => updatedApplication(input, action, ctx);
    case 'add_note':
      return (input) => withNote(input, action.text, ctx);
    case 'add_interview':
      return (input) => withInterview(input, action, ctx);
    case 'update_interview':
      return (input, app) => withInterviewChanged(input, interviewAt(app, action.interview, now).id, action, ctx);
    case 'remove_interview':
      return (input, app) => withoutInterview(input, interviewAt(app, action.interview, now).id);
    default:
      return null;
  }
}

function settingsText(before: NotificationPrefs, after: NotificationPrefs): string {
  const lines: string[] = [];
  if (JSON.stringify(before.reminderOffsetsMin) !== JSON.stringify(after.reminderOffsetsMin)) {
    lines.push(`Reminders ${offsetsSentence(after.reminderOffsetsMin)} each interview`);
  }
  if (before.digest !== after.digest || before.digestHour !== after.digestHour) {
    lines.push(after.digest ? `Morning summary at ${after.digestHour}:00` : 'Morning summary off');
  }
  if (before.timezone !== after.timezone) lines.push(`Time zone ${after.timezone}`);
  if (JSON.stringify(before.enabled) !== JSON.stringify(after.enabled)) lines.push('Reminder channels updated');
  return lines.join(' · ');
}

async function saveSettings(input: ExecInput, before: NotificationPrefs, next: NotificationPrefs, text: string): Promise<ChatPart> {
  await savePrefs(input.userId, next);
  const actionId = await saveAction(input.userId, input.messageId, 'done', { kind: 'settings', before });
  return { kind: 'done', actionId, state: 'done', text };
}

const CHANNEL_NAME = { email: 'email', whatsapp: 'WhatsApp', sms: 'text message' } as const;

async function channelChange(
  input: ExecInput,
  prefs: NotificationPrefs,
  channel: Extract<ChatAction, { type: 'set_channel' }>['channel'],
  on: boolean,
  comingSoon: Set<string>,
): Promise<{ part?: ChatPart; prefs?: NotificationPrefs }> {
  if (channel === 'email' || channel === 'whatsapp' || channel === 'sms') {
    if (comingSoon.has(channel)) return {};
    comingSoon.add(channel);
    return { part: { kind: 'coming_soon', text: `Reminders by ${CHANNEL_NAME[channel]} are coming soon. Telegram and browser notifications work today.` } };
  }
  const name = channel === 'telegram' ? 'Telegram' : 'Browser notifications';
  const isOn = prefs.enabled.includes(channel);
  if (!on) {
    if (!isOn) return { part: { kind: 'done', state: 'done', text: `${name} reminders are already off` } };
    const next = { ...prefs, enabled: prefs.enabled.filter((c) => c !== channel) };
    return { part: await saveSettings(input, prefs, next, `${name} reminders off`), prefs: next };
  }
  if (channel === 'webpush') {
    return { part: webpushConfigured() ? { kind: 'enable_push' } : { kind: 'coming_soon', text: 'Browser notifications aren’t set up on this server yet.' } };
  }
  if (!telegramConfigured()) return { part: { kind: 'coming_soon', text: 'Telegram isn’t set up on this server yet.' } };
  if (!input.channels.telegramLinked) return { part: { kind: 'connect_telegram' } };
  if (isOn) return { part: { kind: 'done', state: 'done', text: 'Telegram reminders are already on' } };
  const next = { ...prefs, enabled: [...prefs.enabled, 'telegram' as const] };
  return { part: await saveSettings(input, prefs, next, 'Telegram reminders on'), prefs: next };
}

// Content the user pasted is someone else's words, so nothing changes until they tap Apply. Only
// what an email can honestly report becomes a proposal: a new application, a stage, an interview.
async function proposalsFromAttachment(input: ExecInput, actions: ChatAction[], rows: AliasedRecord[], ctx: ApplyContext): Promise<ExecResult> {
  const tz = input.prefs.timezone;
  const proposals = new Map<string, UpdateProposal>();
  const parts: ChatPart[] = [];
  let nextAlias = rows.length + 1;
  let skipped = false;
  let kitRef: string | undefined;

  const target = (ref: string): UpdateProposal | undefined => {
    const existing = proposals.get(ref);
    if (existing) return existing;
    const row = rows.find((r) => r.alias === ref);
    if (!row) return undefined;
    const proposal: UpdateProposal = { applicationId: row.id, company: row.application.company, role: row.application.role, summary: '' };
    proposals.set(ref, proposal);
    return proposal;
  };

  for (const action of actions) {
    if (action.type === 'create_application') {
      proposals.set(`A${nextAlias++}`, {
        company: action.company.trim(),
        role: action.role?.trim() || undefined,
        status: action.status === 'saved' || action.status === 'withdrawn' || action.status === 'no_reply' ? 'applied' : action.status,
        round: action.round,
        summary: '',
      });
    } else if (action.type === 'update_application') {
      const p = target(action.ref);
      if (!p) continue;
      if (action.status && action.status !== 'saved' && action.status !== 'withdrawn' && action.status !== 'no_reply') p.status = action.status;
      p.round = action.round ?? p.round;
    } else if (action.type === 'add_interview') {
      const p = target(action.ref);
      if (!p) continue;
      const candidate = Interview.safeParse({
        id: randomUUID(),
        startsAt: zonedTimeToUtc(action.start, tz),
        durationMin: action.durationMin,
        round: action.round,
        meetingUrl: action.link ? ctx.links.get(action.link.trim()) : undefined,
      });
      // An interview already over is old news, not something to put on the calendar.
      if (candidate.success && Date.parse(candidate.data.startsAt) > input.now.getTime()) {
        p.interview = candidate.data;
        p.round = action.round ?? p.round;
      }
    } else if (action.type === 'show' && action.widget === 'make_kit') {
      kitRef = action.ref;
    } else if (action.type === 'answer' || action.type === 'show') {
      continue;
    } else {
      skipped = true;
    }
  }

  // "Make a kit from this job description": the paste is the job description, and Start (a tap) is
  // the confirmation, so the kit card replaces a proposal for that job.
  const kitRow = kitRef ? rows.find((r) => r.alias === kitRef) : undefined;
  const kitNew = kitRef && !kitRow ? proposals.get(kitRef) : undefined;
  const jd = input.attachment?.slice(0, 20_000);
  if (kitRow) {
    parts.push({ kind: 'make_kit', applicationId: kitRow.id, label: `${kitRow.application.company} · ${kitRow.application.role}`, jd });
  } else if (kitNew && !kitNew.applicationId) {
    proposals.delete(kitRef!);
    parts.push({ kind: 'make_kit', label: `${kitNew.company}${kitNew.role ? ` · ${kitNew.role}` : ''}`, company: kitNew.company, role: kitNew.role, jd });
  }

  for (const proposal of proposals.values()) {
    const details = [
      proposal.status ? stageText({ status: proposal.status, round: proposal.round }) : undefined,
      proposal.interview ? `interview ${formatWhen(proposal.interview.startsAt, tz)}` : undefined,
    ].filter(Boolean);
    if (!details.length && proposal.applicationId) continue;
    proposal.summary = [proposal.applicationId ? proposal.company : `New: ${proposal.company}${proposal.role ? ` · ${proposal.role}` : ''}`, ...details].join(' · ');
    const doc = await createEmailUpdate(input.userId, proposal, 'chat');
    parts.push({ kind: 'proposal', update: toUpdateRecord(doc) });
  }
  if (!parts.length) parts.push(errorPart("I couldn't find a job update in what you pasted.", { form: 'add_application' }));
  if (skipped) {
    parts.push({ kind: 'note', text: 'From pasted text I only suggest updates. To change settings, notes or delete something, tell me in your own words.' });
  }
  return { parts, changed: { applications: false, settings: false } };
}
