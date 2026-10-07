import type { ApplicationStatus } from '../../contracts/application.js';
import type { ChatListItem, ChatPart } from '../../contracts/chat.js';
import { followUpDue, isClosed, isStale, nextInterview } from '../applications.js';
import { formatTime, formatWhen, localDateIn } from '../reminders.js';
import { STATUS_NAME, stageText } from './apply.js';
import { upcomingInterviews, type ChatRecord } from './context.js';

const UPCOMING_DAYS = 14;
const MAX_ITEMS = 12;

type ListPart = Extract<ChatPart, { kind: 'list' }>;

function list(title: string, items: ChatListItem[], empty: string): ListPart {
  return { kind: 'list', title, items: items.slice(0, MAX_ITEMS), empty };
}

function interviewsWithin(records: ChatRecord[], now: Date, untilMs: number) {
  return records
    .filter((r) => !isClosed(r.application.status))
    .flatMap((r) => upcomingInterviews(r.application, now).map((interview) => ({ r, interview })))
    .filter(({ interview }) => Date.parse(interview.startsAt) < untilMs)
    .sort((a, b) => a.interview.startsAt.localeCompare(b.interview.startsAt));
}

function interviewTitle(company: string, round: number | undefined): string {
  return `${company} · ${round ? `round ${round} interview` : 'interview'}`;
}

export function todayAnswer(records: ChatRecord[], pendingUpdates: number, timeZone: string, now: Date): ListPart {
  const today = localDateIn(timeZone, now);
  const items: ChatListItem[] = [];
  for (const { r, interview } of interviewsWithin(records, now, now.getTime() + 86_400_000)) {
    if (localDateIn(timeZone, new Date(interview.startsAt)) !== today) continue;
    items.push({ applicationId: r.id, title: interviewTitle(r.application.company, interview.round), detail: `Today at ${formatTime(interview.startsAt, timeZone)}` });
  }
  for (const r of records) {
    if (followUpDue(r.application, now)) {
      items.push({ applicationId: r.id, title: `Follow up with ${r.application.company}`, detail: r.application.followUpOn === today ? 'Due today' : `Was due ${r.application.followUpOn}` });
    }
  }
  if (pendingUpdates) items.push({ title: `${pendingUpdates} ${pendingUpdates === 1 ? 'update' : 'updates'} to review`, detail: 'From emails you pasted or your AI assistant' });
  for (const r of records) {
    if (isStale(r.application, now)) items.push({ applicationId: r.id, title: `No reply from ${r.application.company} in 3 weeks`, detail: 'Worth a follow-up' });
  }
  return list('Today', items, 'Nothing is due today. A good day to apply somewhere new.');
}

export function upcomingAnswer(records: ChatRecord[], timeZone: string, now: Date): ListPart {
  const items = interviewsWithin(records, now, now.getTime() + UPCOMING_DAYS * 86_400_000).map(({ r, interview }) => ({
    applicationId: r.id,
    title: interviewTitle(r.application.company, interview.round),
    detail: formatWhen(interview.startsAt, timeZone),
  }));
  return list('Coming up', items, `No interviews in the next ${UPCOMING_DAYS} days.`);
}

export function followUpsAnswer(records: ChatRecord[], now: Date): ListPart {
  const items = records
    .filter((r) => r.application.followUpOn && !isClosed(r.application.status))
    .sort((a, b) => a.application.followUpOn!.localeCompare(b.application.followUpOn!))
    .map((r) => ({
      applicationId: r.id,
      title: r.application.company,
      detail: `${followUpDue(r.application, now) ? 'Due' : 'Planned'} ${r.application.followUpOn} · ${r.application.role}`,
    }));
  return list('Follow-ups', items, 'No follow-ups planned.');
}

export function quietAnswer(records: ChatRecord[], now: Date): ListPart {
  const items = records
    .filter((r) => isStale(r.application, now))
    .map((r) => ({ applicationId: r.id, title: r.application.company, detail: `${r.application.role} · ${stageText(r.application)}` }));
  return list('No reply in 3 weeks', items, 'Nobody has gone quiet on you. Everything is moving.');
}

export function statusAnswer(record: ChatRecord, timeZone: string, now: Date): ListPart {
  const a = record.application;
  const details = [stageText(a)];
  if (a.appliedOn) details.push(`applied ${a.appliedOn}`);
  const next = nextInterview(a, now);
  if (next) details.push(`next interview ${formatWhen(next.startsAt, timeZone)}`);
  if (a.followUpOn && !isClosed(a.status)) details.push(`follow-up ${a.followUpOn}`);
  return list(a.company, [{ applicationId: record.id, title: `${a.company} · ${a.role}`, detail: details.join(' · ') }], '');
}

export function listAnswer(records: ChatRecord[], stage: ApplicationStatus | undefined): ListPart {
  const matching = records
    .filter((r) => (stage ? r.application.status === stage : !isClosed(r.application.status)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const items = matching.map((r) => ({ applicationId: r.id, title: `${r.application.company} · ${r.application.role}`, detail: stageText(r.application) }));
  const title = stage ? `${STATUS_NAME[stage]} (${matching.length})` : `Open applications (${matching.length})`;
  return list(title, items, stage ? `Nothing in ${STATUS_NAME[stage]}.` : 'No open applications yet. Tell me about one and I’ll add it.');
}
