import type { Application, Interview } from '../../contracts/application.js';
import type { ChatPageName } from '../../contracts/chat.js';
import { interviewEnds, isClosed } from '../applications.js';
import { localDateIn } from '../reminders.js';

export const MAX_CHAT_APPLICATIONS = 150;

export interface ChatRecord {
  id: string;
  application: Application;
  updatedAt: string;
}

export interface AliasedRecord extends ChatRecord {
  alias: string;
}

// Open applications first, most recently touched first, so the ones the user talks about fit under
// the cap. Aliases are rebuilt for every message; the AI never sees or returns a database id.
export function aliasRecords(records: ChatRecord[]): AliasedRecord[] {
  return [...records]
    .sort(
      (a, b) =>
        Number(isClosed(a.application.status)) - Number(isClosed(b.application.status)) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, MAX_CHAT_APPLICATIONS)
    .map((r, i) => ({ ...r, alias: `A${i + 1}` }));
}

export function resolveRef<T extends { alias: string }>(rows: T[], ref: string | undefined): T | undefined {
  return ref ? rows.find((r) => r.alias === ref) : undefined;
}

// Interviews that haven't finished, earliest first. The AI refers to them by position (#1, #2 …).
export function upcomingInterviews(app: Pick<Application, 'interviews'>, now: Date): Interview[] {
  return (app.interviews ?? [])
    .filter((i) => interviewEnds(i) > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// "2026-10-09T15:00" on the wall clock in `timeZone`.
export function localDateTimeIn(timeZone: string, iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${localDateIn(timeZone, date)}T${time}`;
}

function weekday(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short' }).format(date);
}

// One line per application: everything the AI needs to match "Stripe" or "my second round" to a row.
export function applicationRow(row: AliasedRecord, timeZone: string, now: Date): string {
  const a = row.application;
  const stage = a.status === 'interviewing' && a.round ? `interviewing round ${a.round}` : a.status;
  const fields = [row.alias, a.company, a.role, stage];
  if (a.location) fields.push(a.location);
  if (a.appliedOn) fields.push(`applied ${a.appliedOn}`);
  if (a.followUpOn) fields.push(`follow-up ${a.followUpOn}`);
  const interviews = upcomingInterviews(a, now);
  if (interviews.length) {
    fields.push(
      `interviews: ${interviews
        .map((i, n) => {
          const local = localDateTimeIn(timeZone, i.startsAt);
          return `#${n + 1} ${weekday(timeZone, new Date(i.startsAt))} ${local.replace('T', ' ')}${i.round ? ` round ${i.round}` : ''}`;
        })
        .join(', ')}`,
    );
  }
  return fields.join(' | ');
}

export interface ChatPageContext {
  name: ChatPageName;
  applicationId?: string;
}

export function pageLine(page: ChatPageContext, rows: AliasedRecord[]): string {
  const row = page.applicationId ? rows.find((r) => r.id === page.applicationId) : undefined;
  if (row) return `The user is looking at ${row.alias} (${row.application.company} · ${row.application.role}); "this one" or "it" means ${row.alias}.`;
  const names: Record<ChatPageName, string> = {
    home: 'the Home screen',
    applications: 'their Applications board',
    kits: 'their interview kits',
    resumes: 'Resume Studio',
    assistants: 'the AI assistants page',
    other: 'Dossier',
  };
  return `The user is on ${names[page.name]}.`;
}
