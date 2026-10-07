import type { Application, Interview } from '../contracts/application.js';
import { interviewEnds, isClosed, isStale } from './applications.js';

export const REMINDER_OFFSET_MIN = { '2h': 120, '30m': 30 } as const;
export type ReminderKind = keyof typeof REMINDER_OFFSET_MIN;

// The hourly sweep books every reminder due before the next sweep. Five spare minutes cover a sweep
// that runs a little late; a reminder booked twice is still only sent once (see sentReminders).
export const SWEEP_WINDOW_MS = 65 * 60_000;

export interface NotificationMessage {
  title: string;
  body: string;
  // Path inside Dossier to open, e.g. "/applications".
  path: string;
}

export interface DueReminder {
  interview: Interview;
  kind: ReminderKind;
  at: number;
}

export function remindersBetween(interviews: Interview[], kinds: ReminderKind[], fromMs: number, toMs: number): DueReminder[] {
  return interviews.flatMap((interview) =>
    kinds
      .map((kind) => ({ interview, kind, at: Date.parse(interview.startsAt) - REMINDER_OFFSET_MIN[kind] * 60_000 }))
      .filter((r) => r.at >= fromMs && r.at < toMs),
  );
}

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).formatToParts(date).map((p) => [p.type, p.value]),
  );
}

// "2026-10-08" as the calendar date in that time zone.
export function localDateIn(timeZone: string, date: Date): string {
  const p = parts(date, timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

export function localHourIn(timeZone: string, date: Date): number {
  return Number(parts(date, timeZone, { hour: '2-digit', hourCycle: 'h23' }).hour);
}

// "3:00 pm"
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso))
    .replace('AM', 'am')
    .replace('PM', 'pm');
}

// "Thu 8 Oct, 3:00 pm"
export function formatWhen(iso: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
  return `${day}, ${formatTime(iso, timeZone)}`;
}

function interviewLabel(app: Pick<Application, 'company' | 'role'>, interview: Interview): string {
  return `${app.company} · ${app.role}${interview.round ? ` · Round ${interview.round}` : ''}`;
}

export function reminderMessage(
  app: Pick<Application, 'company' | 'role'>,
  interview: Interview,
  kind: ReminderKind,
  timeZone: string,
): NotificationMessage {
  const lines = [interviewLabel(app, interview), `Starts at ${formatWhen(interview.startsAt, timeZone)}`];
  if (interview.meetingUrl) lines.push(`Join: ${interview.meetingUrl}`);
  return {
    title: kind === '2h' ? 'Interview in 2 hours' : 'Interview in 30 minutes',
    body: lines.join('\n'),
    path: '/applications',
  };
}

// The morning summary, or null on a day with nothing worth a message.
export function digestMessage(apps: Application[], timeZone: string, now: Date): NotificationMessage | null {
  const today = localDateIn(timeZone, now);
  const open = apps.filter((a) => !isClosed(a.status));

  const interviews = open
    .flatMap((app) => (app.interviews ?? []).map((interview) => ({ app, interview })))
    .filter(({ interview }) => localDateIn(timeZone, new Date(interview.startsAt)) === today && interviewEnds(interview) > now.getTime())
    .sort((a, b) => a.interview.startsAt.localeCompare(b.interview.startsAt));
  const followUps = open.filter((a) => a.followUpOn && a.followUpOn <= today);
  const stale = open.filter((a) => !(a.followUpOn && a.followUpOn <= today) && isStale(a, now));

  if (!interviews.length && !followUps.length && !stale.length) return null;

  const lines: string[] = [];
  if (interviews.length) {
    lines.push(
      `Interviews today: ${interviews
        .map(({ app, interview }) => `${app.company}${interview.round ? ` R${interview.round}` : ''} at ${formatTime(interview.startsAt, timeZone)}`)
        .join(', ')}`,
    );
  }
  if (followUps.length) lines.push(`Follow up with: ${followUps.map((a) => a.company).join(', ')}`);
  if (stale.length) lines.push(`No reply in 3 weeks: ${stale.map((a) => a.company).join(', ')}`);
  return { title: 'Your job search today', body: lines.join('\n'), path: '/applications' };
}
