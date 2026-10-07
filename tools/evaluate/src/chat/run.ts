import { readFileSync, writeFileSync } from 'node:fs';
import {
  CHAT_SYSTEM,
  ChatPlan,
  GeminiClient,
  GroqClient,
  RateLimiter,
  aliasRecords,
  applicationRow,
  buildChatPrompt,
  localDateIn,
  pageLine,
  redact,
  type Application,
  type ChatAction,
  type LlmModel,
  type LlmPort,
} from '@dossier/core';

// Scores the chat planner on fixed messages: does each one produce the actions a person would expect?
// Usage: npm run evaluate:chat -- [--provider gemini|groq] [--model flash-lite|flash] [--only en-04] [--out results.json]

interface Case {
  id: string;
  lang: string;
  text: string;
  attachment?: string;
  page?: string;
  linkFacts?: string[];
  expect: { actions: (Partial<ChatAction> & { type: ChatAction['type'] })[]; question?: boolean; forbid?: ChatAction['type'][] };
}

// Changing things nobody asked for is the failure that matters most, so these never count as harmless extras.
const RISKY: ChatAction['type'][] = ['delete_application', 'set_channel', 'set_reminders'];

const TZ = 'Asia/Kolkata';
// Wednesday 7 Oct 2026, 10:00 in India: every expected date in cases.json is worked out from this.
const NOW = new Date('2026-10-07T04:30:00.000Z');
const at = (local: string) => new Date(`${local}:00+05:30`).toISOString();

const app = (a: Partial<Application> & Pick<Application, 'company' | 'role' | 'status'>): Application => ({
  statusHistory: [{ status: a.status, at: '2026-09-27T06:00:00.000Z' }],
  source: 'manual',
  ...a,
});

// Aliases come out as A1 Stripe FE, A2 Stripe BE, A3 Razorpay, A4 Swiggy, A5 Google, A6 CRED,
// A7 Flipkart (open but untouched for a month), A8 Zomato (closed, so last).
const RECORDS = [
  { id: 'r1', updatedAt: '2026-10-06T06:00:00.000Z', application: app({ company: 'Stripe', role: 'Frontend Engineer', status: 'interviewing', round: 1, appliedOn: '2026-09-28', interviews: [{ id: 'i1', startsAt: at('2026-10-09T15:00'), round: 1 }] }) },
  { id: 'r2', updatedAt: '2026-10-05T06:00:00.000Z', application: app({ company: 'Stripe', role: 'Backend Engineer', status: 'applied', appliedOn: '2026-09-30' }) },
  { id: 'r3', updatedAt: '2026-10-04T06:00:00.000Z', application: app({ company: 'Razorpay', role: 'SDE 2', status: 'applied', appliedOn: '2026-10-01' }) },
  { id: 'r4', updatedAt: '2026-10-03T06:00:00.000Z', application: app({ company: 'Swiggy', role: 'Software Engineer', status: 'online_test', appliedOn: '2026-09-25', followUpOn: '2026-10-09' }) },
  { id: 'r5', updatedAt: '2026-10-02T06:00:00.000Z', application: app({ company: 'Google', role: 'SWE III', status: 'saved' }) },
  { id: 'r7', updatedAt: '2026-10-01T06:00:00.000Z', application: app({ company: 'CRED', role: 'Frontend Developer', status: 'offer', appliedOn: '2026-09-10' }) },
  { id: 'r6', updatedAt: '2026-09-07T06:00:00.000Z', application: app({ company: 'Flipkart', role: 'UI Engineer', status: 'applied', appliedOn: '2026-09-01' }) },
  { id: 'r8', updatedAt: '2026-09-30T06:00:00.000Z', application: app({ company: 'Zomato', role: 'SDE 1', status: 'rejected', appliedOn: '2026-09-05' }) },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function llm(): LlmPort {
  if (arg('provider') === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is required');
    return new GroqClient({ apiKey, rateLimiter: new RateLimiter({ rpm: 20, tpm: 1_000_000 }) });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  return new GeminiClient({ apiKey, rateLimiter: new RateLimiter({ rpm: 10, tpm: 1_000_000 }), maxAttempts: 3 });
}

function promptFor(c: Case): string {
  const rows = aliasRecords(RECORDS);
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long' }).format(NOW);
  return buildChatPrompt({
    today: `${weekday} ${localDateIn(TZ, NOW)}`,
    time: '10:00',
    timeZone: TZ,
    settings: 'reminders 2 hours and 30 minutes before each interview; morning summary on at 8:00; Telegram not connected; browser notifications on.',
    rows: rows.map((r) => applicationRow(r, TZ, NOW)),
    page: pageLine({ name: c.page ? 'applications' : 'home', applicationId: c.page }, rows),
    history: [],
    message: redact(c.text).text,
    attachment: c.attachment ? redact(c.attachment).text : undefined,
    linkFacts: c.linkFacts ?? [],
  });
}

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  if (typeof a === 'string' && typeof b === 'string') return a.trim().toLowerCase() === b.trim().toLowerCase();
  return a === b;
}

// Every expected action must appear with its key fields; extra actions are fine unless they're risky
// or forbidden; a case that expects a question must ask one.
function score(c: Case, plan: ChatPlan): string[] {
  const problems: string[] = [];
  const unmatched = [...plan.actions];
  for (const expected of c.expect.actions) {
    const i = unmatched.findIndex((a) => Object.entries(expected).every(([k, v]) => same((a as Record<string, unknown>)[k], v)));
    if (i >= 0) unmatched.splice(i, 1);
    else problems.push(`missing ${JSON.stringify(expected)}`);
  }
  const forbidden = new Set([...(c.expect.forbid ?? []), ...RISKY]);
  for (const extra of unmatched) if (forbidden.has(extra.type)) problems.push(`unexpected ${JSON.stringify(extra)}`);
  if (c.expect.question && !plan.question) problems.push('should have asked a question');
  if (c.expect.actions.length === 0 && !c.expect.question && plan.actions.length) problems.push(`expected no actions, got ${plan.actions.map((a) => a.type).join(', ')}`);
  return problems;
}

async function main() {
  const cases = (JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as Case[]).filter(
    (c) => !arg('only') || c.id === arg('only'),
  );
  const model = (arg('model') ?? 'flash-lite') as LlmModel;
  const client = llm();
  const results: { id: string; lang: string; ok: boolean; ms: number; problems: string[]; plan?: ChatPlan }[] = [];

  for (const c of cases) {
    const started = Date.now();
    let plan: ChatPlan | undefined;
    let problems: string[];
    try {
      plan = await client.generate({ model, system: CHAT_SYSTEM, prompt: promptFor(c), schema: ChatPlan, maxOutputTokens: 2048 });
      problems = score(c, plan);
    } catch (err) {
      problems = [`call failed: ${(err as Error).message.slice(0, 200)}`];
    }
    const ms = Date.now() - started;
    results.push({ id: c.id, lang: c.lang, ok: problems.length === 0, ms, problems, plan });
    console.log(`${problems.length ? 'FAIL' : 'pass'} ${c.id.padEnd(7)} ${String(ms).padStart(5)}ms  ${c.text.slice(0, 60)}`);
    for (const p of problems) console.log(`       ${p}`);
  }

  const byLang = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const s = byLang.get(r.lang) ?? { pass: 0, total: 0 };
    s.total += 1;
    if (r.ok) s.pass += 1;
    byLang.set(r.lang, s);
  }
  const passed = results.filter((r) => r.ok).length;
  const avg = Math.round(results.reduce((sum, r) => sum + r.ms, 0) / Math.max(1, results.length));
  console.log(`\n${passed}/${results.length} passed · avg ${avg}ms · ${[...byLang].map(([l, s]) => `${l} ${s.pass}/${s.total}`).join(' · ')}`);
  const out = arg('out');
  if (out) writeFileSync(out, JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
