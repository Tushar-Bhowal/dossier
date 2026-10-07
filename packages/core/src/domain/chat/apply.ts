import type { ApplicationInput, ApplicationStatus, Interview } from '../../contracts/application.js';
import type { ChatAction } from '../../contracts/chat.js';
import {
  MAX_REMINDER_OFFSET,
  MIN_REMINDER_OFFSET,
  isTimeZone,
  type NotificationPrefs,
} from '../../contracts/notifications.js';
import { applyProposal, zonedTimeToUtc } from '../emailUpdate.js';
import { localDateIn } from '../reminders.js';

type Action<T extends ChatAction['type']> = Extract<ChatAction, { type: T }>;

export const STATUS_NAME: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  online_test: 'Online test',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  no_reply: 'No reply',
};

export function stageText(app: Pick<ApplicationInput, 'status' | 'round'>): string {
  return app.status === 'interviewing' && app.round ? `Interviewing, round ${app.round}` : STATUS_NAME[app.status];
}

export interface ApplyContext {
  now: Date;
  timeZone: string;
  // Placeholder → the real address from the user's own message, already checked to be http(s).
  links: Map<string, string>;
  newId: () => string;
}

const MAX_NOTES = 4000;
const MAX_INTERVIEWS = 20;

// The AI's list of minutes, made safe: in range, no repeats, longest first, at most three.
export function cleanOffsets(offsets: number[] | undefined): number[] | undefined {
  if (!offsets) return undefined;
  return [...new Set(offsets.filter((m) => Number.isInteger(m) && m >= MIN_REMINDER_OFFSET && m <= MAX_REMINDER_OFFSET))]
    .sort((a, b) => b - a)
    .slice(0, 3);
}

function link(ctx: ApplyContext, token: string | undefined): string | undefined {
  return token ? ctx.links.get(token.trim()) : undefined;
}

function today(ctx: ApplyContext): string {
  return localDateIn(ctx.timeZone, ctx.now);
}

function appendNote(notes: string | undefined, text: string, ctx: ApplyContext): string {
  const entry = `${today(ctx)}: ${text.trim()}`;
  const all = notes?.trim() ? `${notes.trim()}\n\n${entry}` : entry;
  // Oldest notes give way first when the field is full.
  return all.length > MAX_NOTES ? all.slice(all.length - MAX_NOTES) : all;
}

export function newApplication(action: Action<'create_application'>, ctx: ApplyContext): ApplicationInput {
  const status = action.status ?? 'applied';
  return {
    company: action.company.trim(),
    role: action.role?.trim() || 'Role not stated',
    status,
    round: status === 'interviewing' ? action.round : undefined,
    appliedOn: status === 'saved' ? undefined : (action.appliedOn ?? today(ctx)),
    followUpOn: action.followUpOn,
    location: action.location?.trim() || undefined,
    jobUrl: link(ctx, action.link),
    notes: action.note?.trim() ? appendNote(undefined, action.note, ctx) : undefined,
  };
}

export function updatedApplication(input: ApplicationInput, action: Action<'update_application'>, ctx: ApplyContext): ApplicationInput {
  // A round on its own ("I'm in round 3 now") means the application is interviewing.
  const status = action.status ?? (action.round && input.status !== 'interviewing' ? 'interviewing' : input.status);
  return {
    ...input,
    status,
    round: status === 'interviewing' ? (action.round ?? input.round) : undefined,
    appliedOn: action.appliedOn ?? input.appliedOn,
    followUpOn: action.clearFollowUp ? undefined : (action.followUpOn ?? input.followUpOn),
    company: action.company?.trim() || input.company,
    role: action.role?.trim() || input.role,
    location: action.location?.trim() || input.location,
    jobUrl: link(ctx, action.link) ?? input.jobUrl,
  };
}

export function withNote(input: ApplicationInput, text: string, ctx: ApplyContext): ApplicationInput {
  return { ...input, notes: appendNote(input.notes, text, ctx) };
}

export function withInterview(input: ApplicationInput, action: Action<'add_interview'>, ctx: ApplyContext): ApplicationInput {
  const interview: Interview = {
    id: ctx.newId(),
    startsAt: zonedTimeToUtc(action.start, ctx.timeZone),
    durationMin: action.durationMin,
    round: action.round ?? (input.status === 'interviewing' ? input.round : undefined),
    meetingUrl: link(ctx, action.link),
    reminderOffsetsMin: cleanOffsets(action.reminderOffsetsMin),
  };
  // Same rules as an interview from an email: the stage moves forward to Interviewing, and a closed
  // application reopens, because the user has just said there is an interview.
  const next = applyProposal(input, { company: input.company, status: 'interviewing', round: action.round, interview, summary: '' });
  return { ...next, interviews: next.interviews?.slice(-MAX_INTERVIEWS) };
}

export function withInterviewChanged(
  input: ApplicationInput,
  interviewId: string,
  action: Action<'update_interview'>,
  ctx: ApplyContext,
): ApplicationInput {
  return {
    ...input,
    interviews: input.interviews?.map((i) =>
      i.id !== interviewId
        ? i
        : {
            ...i,
            startsAt: action.start ? zonedTimeToUtc(action.start, ctx.timeZone) : i.startsAt,
            durationMin: action.durationMin ?? i.durationMin,
            round: action.round ?? i.round,
            meetingUrl: link(ctx, action.link) ?? i.meetingUrl,
            reminderOffsetsMin: cleanOffsets(action.reminderOffsetsMin) ?? i.reminderOffsetsMin,
          },
    ),
  };
}

export function withoutInterview(input: ApplicationInput, interviewId: string): ApplicationInput {
  return { ...input, interviews: input.interviews?.filter((i) => i.id !== interviewId) };
}

// Undefined when the action changes nothing that can be saved.
export function updatedPrefs(prefs: NotificationPrefs, action: Action<'set_reminders'>): NotificationPrefs | undefined {
  const offsets = cleanOffsets(action.offsetsMin);
  const timezone = action.timezone && isTimeZone(action.timezone) ? action.timezone : undefined;
  const next: NotificationPrefs = {
    ...prefs,
    reminderOffsetsMin: offsets?.length ? offsets : prefs.reminderOffsetsMin,
    digest: action.digest ?? prefs.digest,
    digestHour: action.digestHour ?? prefs.digestHour,
    timezone: timezone ?? prefs.timezone,
  };
  return JSON.stringify(next) === JSON.stringify(prefs) ? undefined : next;
}
