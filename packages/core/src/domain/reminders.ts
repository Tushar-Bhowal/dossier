import type { Application, Interview } from '../contracts/application.js';
import { MAX_REMINDER_OFFSET } from '../contracts/notifications.js';
import { interviewEnds, isClosed, isStale } from './applications.js';

// Reminder messages booked before reminder times existed named one of two fixed times.
export const LEGACY_REMINDER_OFFSET = { '2h': 120, '30m': 30 } as const;

// The hourly sweep books every reminder due before the next sweep. Five spare minutes cover a sweep
// that runs a little late; a reminder booked twice is still only sent once (see sentReminders).
export const SWEEP_WINDOW_MS = 65 * 60_000;
// How far ahead the sweep looks for interviews: the window plus the earliest possible reminder.
export const SWEEP_LOOKAHEAD_MS = SWEEP_WINDOW_MS + MAX_REMINDER_OFFSET * 60_000;

export interface NotificationMessage {
  title: string;
  body: string;
  // Path inside Dossier to open, e.g. "/applications".
  path: string;
}

export interface DueReminder {
  interview: Interview;
  offsetMin: number;
  at: number;
}

// An interview's own reminder times win over the user's usual ones.
export function offsetsFor(defaults: number[], interview: Interview): number[] {
  return [...new Set(interview.reminderOffsetsMin ?? defaults)];
}

export function remindersBetween(interviews: Interview[], defaults: number[], fromMs: number, toMs: number): DueReminder[] {
  return interviews.flatMap((interview) =>
    offsetsFor(defaults, interview)
      .map((offsetMin) => ({ interview, offsetMin, at: Date.parse(interview.startsAt) - offsetMin * 60_000 }))
      .filter((r) => r.at >= fromMs && r.at < toMs),
  );
}

// 30 → "30 minutes", 60 → "1 hour", 90 → "1 hour 30 minutes", 1440 → "1 day".
export function offsetLabel(minutes: number): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (minutes % 1440 === 0) return unit(minutes / 1440, 'day');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? unit(h, 'hour') : '', m ? unit(m, 'minute') : ''].filter(Boolean).join(' ');
}

// "2 hours and 30 minutes before" / "no reminders"
export function offsetsSentence(offsets: number[]): string {
  if (!offsets.length) return 'no reminders';
  const labels = [...offsets].sort((a, b) => b - a).map(offsetLabel);
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
  return `${list} before`;
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
  offsetMin: number,
  timeZone: string,
): NotificationMessage {
  const lines = [interviewLabel(app, interview), `Starts at ${formatWhen(interview.startsAt, timeZone)}`];
  if (interview.meetingUrl) lines.push(`Join: ${interview.meetingUrl}`);
  return {
    title: `Interview in ${offsetLabel(offsetMin)}`,
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
