import type { Application, ApplicationInput, ApplicationStatus } from '../contracts/application.js';
import type { UpdateProposal } from '../contracts/emailUpdate.js';
import { isClosed } from './applications.js';

// How far `timeZone` is ahead of UTC at `date`, in ms (India: +5:30).
function offsetMs(timeZone: string, date: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((x) => [x.type, Number(x.value)]),
  );
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// "2026-10-14T15:00" on the wall clock in `timeZone` → the UTC instant, as an ISO string. Checked twice
// so a time next to a daylight-saving change lands on the right side of it.
export function zonedTimeToUtc(local: string, timeZone: string): string {
  const [date, time] = local.split('T') as [string, string];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall - offsetMs(timeZone, new Date(wall));
  utc = wall - offsetMs(timeZone, new Date(utc));
  return new Date(utc).toISOString();
}

const COMPANY_NOISE = /\b(inc|llc|ltd|limited|pvt|private|corp|corporation|co|technologies|technology|labs|group|india|software|solutions)\b/g;

export function companyKey(name: string): string {
  return name.toLowerCase().replace(COMPANY_NOISE, ' ').replace(/[^a-z0-9]/g, '');
}

function roleWords(role: string | undefined): Set<string> {
  return new Set((role ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
}

// The tracked application this email is about: same company (ignoring "Inc", "Pvt Ltd"…), preferring
// open applications, then the closest job title. Undefined means "probably a new application".
export function matchApplication<T extends { id: string; application: Application }>(
  records: T[],
  company: string,
  role?: string,
): T | undefined {
  const key = companyKey(company);
  if (!key) return undefined;
  const sameCompany = records.filter((r) => {
    const other = companyKey(r.application.company);
    return other && (other === key || other.includes(key) || key.includes(other));
  });
  const words = roleWords(role);
  const score = (r: T) =>
    (isClosed(r.application.status) ? 0 : 100) + [...roleWords(r.application.role)].filter((w) => words.has(w)).length;
  return sameCompany.sort((a, b) => score(b) - score(a))[0];
}

const STAGE_ORDER: ApplicationStatus[] = ['saved', 'applied', 'online_test', 'interviewing', 'offer'];

// Forward only: an "application received" email arriving late must not drag an application that's
// already interviewing back to Applied. A rejection always applies. A closed application only reopens
// for real progress (an interview or an offer), never for a stale "we got your application".
function nextStatus(current: ApplicationStatus, proposed: ApplicationStatus | undefined): ApplicationStatus {
  if (!proposed) return current;
  if (proposed === 'rejected') return proposed;
  if (isClosed(current)) return proposed === 'interviewing' || proposed === 'offer' ? proposed : current;
  return STAGE_ORDER.indexOf(proposed) > STAGE_ORDER.indexOf(current) ? proposed : current;
}

export function applyProposal(input: ApplicationInput, proposal: UpdateProposal): ApplicationInput {
  const interviews = input.interviews ?? [];
  const isNewInterview = proposal.interview && !interviews.some((i) => i.startsAt === proposal.interview!.startsAt);
  let status = nextStatus(input.status, proposal.status);
  // An interview on the calendar means the process has reached interviews.
  if (isNewInterview && STAGE_ORDER.indexOf(status) < STAGE_ORDER.indexOf('interviewing') && !isClosed(status)) {
    status = 'interviewing';
  }
  const round = status === 'interviewing' ? (proposal.round ?? proposal.interview?.round ?? input.round) : input.round;
  return {
    ...input,
    status,
    round,
    interviews: isNewInterview ? [...interviews, proposal.interview!] : input.interviews,
  };
}
