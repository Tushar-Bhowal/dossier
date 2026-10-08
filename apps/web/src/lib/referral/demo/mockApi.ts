import {
  CONNECTION_NOTE_LIMIT,
  Pitch,
  REFERRAL_MESSAGE_LIMIT,
  linkedinSearchUrl,
  type DraftKind,
  type DraftResult,
  type ReferralContact,
  type ReferralSuggestion,
  type SuggestResult,
} from "@dossier/core/applications";
import { ApiError } from "@/lib/api";
import { READ_DELAY_MS, sleep, type Persona } from "@/lib/demo/scenario";
import { referralScenario } from "./scenario";

const PITCHES: Record<Persona, string> = {
  engineer: "Backend engineer with 2 years building Python APIs for a lending company. I cut our loan-status API's response time from 900 ms to 350 ms and like owning a service end to end.",
  teacher: "Maths and Science teacher for classes 6 to 8 at St. Mary's School, Kolkata, with a B.Ed. Last year my Class 8 section's pass rate went from 78% to 92%.",
};

interface JobContext {
  company: string;
  role: string;
  jobUrl?: string;
}

let pitch: string | null = null;
let pitchKey = "";
const contacts = new Map<string, ReferralContact[]>();
let counter = 0;
const clone = <T,>(v: T): T => structuredClone(v);

function currentPitch(): string {
  const { persona, empty } = referralScenario.getScenario();
  const key = `${persona}:${empty}`;
  if (pitchKey !== key) {
    pitchKey = key;
    pitch = empty ? "" : PITCHES[persona];
    contacts.clear();
  }
  return pitch ?? "";
}

function failures() {
  const { fail } = referralScenario.getScenario();
  if (fail === "ai_down") throw new ApiError(503, "llm_unavailable", "Our AI service isn't responding right now.");
  if (fail === "quota") throw new ApiError(429, "quota_exceeded", "You've used today's free AI requests.");
}

// Sample people only: the profile links are placeholders and the page never opens them.
function samplePeople({ company, role }: JobContext): ReferralSuggestion[] {
  const people: [string, string, ReferralSuggestion["kind"], string][] = [
    ["Ananya Sharma", `Talent Acquisition Partner at ${company}`, "recruiter", "Recruits for this kind of role at the company"],
    ["Rohit Verma", `${role} at ${company}`, "peer", "Same role, at the company now"],
    ["Priya Nair", `Senior ${role} at ${company} · ex-Flipkart`, "peer", "Same role, more senior: often on interview panels"],
    ["Karthik Iyer", `Engineering Manager at ${company}`, "peer", "Likely manages people in this role"],
  ];
  return people.map(([name, headline, kind, reason], i) => ({
    name,
    headline,
    kind,
    reason,
    profileUrl: `https://www.linkedin.com/in/sample-person-${i + 1}`,
  }));
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

// First sentence, without treating "St." or "Dr." as the end of one.
function firstSentence(text: string): string {
  const match = text.match(/^.*?(?<!\b(?:St|Dr|Mr|Mrs|Ms|Jr|Sr|vs|e\.g|i\.e))[.!?](?=\s|$)/);
  return (match?.[0] ?? text).trim();
}

function fit(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

export const mockApi = {
  async getPitch(): Promise<Pitch> {
    await sleep(READ_DELAY_MS);
    return { text: currentPitch() };
  },

  async savePitch(input: Pitch): Promise<Pitch> {
    const parsed = Pitch.safeParse(input);
    if (!parsed.success) throw new ApiError(400, "validation_error", parsed.error.issues[0]?.message ?? "Too long");
    await sleep(READ_DELAY_MS);
    currentPitch();
    pitch = parsed.data.text;
    return { text: pitch };
  },

  async listContacts(applicationId: string): Promise<ReferralContact[]> {
    await sleep(READ_DELAY_MS);
    currentPitch();
    return clone(contacts.get(applicationId) ?? []);
  },

  async suggest(applicationId: string, job: JobContext): Promise<SuggestResult> {
    await sleep(referralScenario.aiDelayMs());
    failures();
    currentPitch();
    const kept = new Set((contacts.get(applicationId) ?? []).map((c) => c.profileUrl));
    const found = referralScenario.getScenario().fail === "search_empty" ? [] : samplePeople(job).filter((p) => !kept.has(p.profileUrl));
    return { suggestions: found, linkedinSearchUrl: linkedinSearchUrl(job.company, job.role) };
  },

  async keep(applicationId: string, suggestion: ReferralSuggestion): Promise<ReferralContact> {
    await sleep(READ_DELAY_MS);
    counter += 1;
    const contact: ReferralContact = {
      id: `c${counter}`,
      name: suggestion.name,
      headline: suggestion.headline,
      profileUrl: suggestion.profileUrl,
      kind: suggestion.kind,
      status: "to_contact",
      updatedAt: new Date().toISOString(),
    };
    contacts.set(applicationId, [...(contacts.get(applicationId) ?? []), contact]);
    return clone(contact);
  },

  async updateContact(applicationId: string, contact: ReferralContact): Promise<ReferralContact> {
    await sleep(READ_DELAY_MS);
    const next = { ...contact, updatedAt: new Date().toISOString() };
    contacts.set(applicationId, (contacts.get(applicationId) ?? []).map((c) => (c.id === contact.id ? next : c)));
    return clone(next);
  },

  async removeContact(applicationId: string, contactId: string): Promise<void> {
    await sleep(READ_DELAY_MS);
    contacts.set(applicationId, (contacts.get(applicationId) ?? []).filter((c) => c.id !== contactId));
  },

  // Uses only the pitch, the role and the contact's first name and headline; no claims beyond the pitch.
  async draft(applicationId: string, contactId: string, kind: DraftKind, job: JobContext): Promise<DraftResult> {
    await sleep(referralScenario.aiDelayMs());
    failures();
    const contact = (contacts.get(applicationId) ?? []).find((c) => c.id === contactId);
    if (!contact) throw new ApiError(404, "not_found", "contact not found");
    const about = firstSentence(currentPitch());
    const name = firstName(contact.name);
    if (kind === "connection") {
      const text =
        contact.kind === "recruiter"
          ? `Hi ${name}, I'm applying for the ${job.role} role at ${job.company}. ${about} Would be glad to connect.`
          : `Hi ${name}, I'm applying for the ${job.role} role at ${job.company} and would love to hear what the team is like. ${about}`;
      return { kind, text: fit(text, CONNECTION_NOTE_LIMIT) };
    }
    const link = job.jobUrl ? `\n\nThe job: ${job.jobUrl}` : "";
    const text = `Hi ${name}, thanks for connecting.\n\nI've applied for the ${job.role} role at ${job.company}. ${currentPitch()}\n\nIf you think I'd be a fit, would you be open to referring me? I'm happy to send my resume and a short note you can forward. No worries at all if not.${link}\n\nThanks!`;
    return { kind, text: fit(text, REFERRAL_MESSAGE_LIMIT) };
  },
};
