import {
  CLOSED_STATUSES,
  type Application,
  type ApplicationInput,
  type ApplicationStatus,
  type StatusEvent,
} from '../contracts/application.js';

export const STALE_AFTER_DAYS = 21;
const DAY_MS = 86_400_000;

export function isClosed(status: ApplicationStatus): boolean {
  return (CLOSED_STATUSES as readonly ApplicationStatus[]).includes(status);
}

// The user's calendar date, not UTC: a follow-up set for "today" in India must not be a day off.
export function toLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return toLocalDate(new Date(y, m - 1, d + days));
}

// Normalises round/appliedOn for the new status and appends a history entry only when the stage or
// round actually changed. `prev` is null for a new application.
export function applyStatusChange(
  prev: Pick<Application, 'status' | 'round' | 'statusHistory'> | null,
  next: ApplicationInput,
  now: Date,
): Pick<Application, 'round' | 'appliedOn' | 'statusHistory'> {
  const round = next.status === 'interviewing' ? (next.round ?? 1) : undefined;
  const appliedOn = next.appliedOn ?? (next.status === 'saved' ? undefined : toLocalDate(now));
  const history: StatusEvent[] = prev?.statusHistory ?? [];
  const changed = !prev || prev.status !== next.status || prev.round !== round;
  const event: StatusEvent = { status: next.status, at: now.toISOString(), ...(round ? { round } : {}) };
  return { round, appliedOn, statusHistory: changed ? [...history, event].slice(-200) : history };
}

export function lastStatusChange(app: Pick<Application, 'statusHistory'>): string | undefined {
  return app.statusHistory.at(-1)?.at;
}

// Waiting on the company with nothing heard for three weeks, and no follow-up already planned.
export function isStale(app: Application, now: Date): boolean {
  if (!['applied', 'online_test', 'interviewing'].includes(app.status)) return false;
  if (app.followUpOn && app.followUpOn >= toLocalDate(now)) return false;
  const last = lastStatusChange(app);
  return last !== undefined && now.getTime() - Date.parse(last) >= STALE_AFTER_DAYS * DAY_MS;
}

export function followUpDue(app: Application, now: Date): boolean {
  return !!app.followUpOn && !isClosed(app.status) && app.followUpOn <= toLocalDate(now);
}
