import {
  CHAT_SYSTEM,
  ChatPlan,
  HttpFetcher,
  aliasRecords,
  applicationRow,
  buildChatPrompt,
  localDateIn,
  offsetsSentence,
  pageLine,
  previewFromJobPage,
  redact,
  type AliasedRecord,
  type ApplicationPreview,
  type ChatPageContext,
  type ChatRecord,
  type ChatTurn,
  type LlmPort,
  type NotificationPrefs,
} from '@dossier/core';
import { buildPipelineDeps } from '../pipelineDeps.js';

let llm: LlmPort | null = null;
function getLlm(): LlmPort {
  llm ??= buildPipelineDeps().llm;
  return llm;
}

const fetcher = new HttpFetcher({ allowPrivateHosts: false });
const ATTACHMENT_SEPARATOR = '\n\n<<<DOSSIER-ATTACHMENT>>>\n\n';
const MAX_LINKS_READ = 2;

export interface ChannelState {
  telegramLinked: boolean;
  pushDevices: number;
}

export interface PlannerInput {
  text: string;
  attachment?: string;
  page: ChatPageContext;
  prefs: NotificationPrefs;
  channels: ChannelState;
  records: ChatRecord[];
  history: ChatTurn[];
  now: Date;
  step: (text: string) => void;
}

export interface Planned {
  plan: ChatPlan;
  rows: AliasedRecord[];
  // Placeholder → real http(s) address, from the user's message or attachment.
  links: Map<string, string>;
  // Placeholder → what our page reader found on that job page (never sent whole to the AI).
  pages: Map<string, ApplicationPreview>;
  // Placeholders of links the user typed: Meet/Zoom/Teams, and everything else (job postings).
  meetingLinks: string[];
  jobLinks: string[];
}

function httpUrl(value: string): string | undefined {
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

// Meeting links (Meet, Zoom, Teams) aren't job pages; reading them would only waste the time budget.
const MEETING_HOST = /(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|calendly\.com)$/i;

function isMeetingLink(url: string): boolean {
  return MEETING_HOST.test(new URL(url).hostname);
}

async function readJobPage(url: string): Promise<ApplicationPreview | undefined> {
  if (isMeetingLink(url)) return undefined;
  try {
    const page = await fetcher.fetch(url);
    if (!page.contentType.includes('html')) return undefined;
    const preview = previewFromJobPage(page.finalUrl, page.text);
    return preview.company || preview.role || preview.jdText ? preview : undefined;
  } catch {
    return undefined;
  }
}

function settingsLine(prefs: NotificationPrefs, channels: ChannelState): string {
  const reminders = prefs.reminderOffsetsMin.length ? `reminders ${offsetsSentence(prefs.reminderOffsetsMin)} each interview` : 'interview reminders off';
  const digest = prefs.digest ? `morning summary on at ${prefs.digestHour}:00` : 'morning summary off';
  const telegram = channels.telegramLinked ? (prefs.enabled.includes('telegram') ? 'Telegram on' : 'Telegram connected but off') : 'Telegram not connected';
  const push = prefs.enabled.includes('webpush') ? 'browser notifications on' : 'browser notifications off';
  return `${reminders}; ${digest}; ${telegram}; ${push}.`;
}

// Redact → one AI call → a validated plan. Our code, not the model, decides what happens with it.
export async function planMessage(input: PlannerInput): Promise<Planned> {
  const tz = input.prefs.timezone;
  // Redacted together so a link in the message and the same link in the attachment share a placeholder.
  const combined = redact(input.attachment ? `${input.text}${ATTACHMENT_SEPARATOR}${input.attachment}` : input.text);
  const [safeText = '', safeAttachment] = combined.text.split(ATTACHMENT_SEPARATOR);

  const links = new Map<string, string>();
  for (const item of combined.items) {
    const url = item.kind === 'link' ? httpUrl(item.value) : undefined;
    if (url) links.set(item.token, url);
  }

  // Only links the user typed are read as job pages; an attachment's links are just carried along.
  const pages = new Map<string, ApplicationPreview>();
  const typed = [...links].filter(([token]) => safeText.includes(token));
  const meetingLinks = typed.filter(([, url]) => isMeetingLink(url)).map(([token]) => token);
  const jobLinks = typed.filter(([, url]) => !isMeetingLink(url)).map(([token]) => token);
  const typedLinks = typed.filter(([, url]) => !isMeetingLink(url)).slice(0, MAX_LINKS_READ);
  if (typedLinks.length) {
    input.step('Reading the job page');
    const previews = await Promise.all(typedLinks.map(([, url]) => readJobPage(url)));
    typedLinks.forEach(([token], i) => {
      if (previews[i]) pages.set(token, previews[i]);
    });
  }
  const linkFacts = [...pages].map(
    ([token, p]) => `${token} is a job page: company "${p.company?.slice(0, 120) ?? 'unknown'}", role "${p.role?.slice(0, 160) ?? 'unknown'}".`,
  );

  const rows = aliasRecords(input.records);
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long' }).format(input.now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(input.now);
  const history = input.history.map((t) => ({ ...t, text: redact(t.text).text }));

  input.step('Understanding');
  // flash-lite, not flash: on the free key flash allows only 20 requests a day (C0 spike, 2026-10-07),
  // and flash-lite returned a valid plan for 30 of 30 test messages in about 2 seconds.
  const plan = await getLlm().generate({
    model: 'flash-lite',
    system: CHAT_SYSTEM,
    prompt: buildChatPrompt({
      today: `${weekday} ${localDateIn(tz, input.now)}`,
      time,
      timeZone: tz,
      settings: settingsLine(input.prefs, input.channels),
      rows: rows.map((r) => applicationRow(r, tz, input.now)),
      page: pageLine(input.page, rows),
      history,
      message: safeText.trim(),
      attachment: safeAttachment?.trim(),
      linkFacts,
    }),
    schema: ChatPlan,
    maxOutputTokens: 2048,
  });
  return { plan, rows, links, pages, meetingLinks, jobLinks };
}
