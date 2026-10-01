import type { CareerProfile, Entry, Fact, Resume, ResumeSnapshot, TailoringState } from "@dossier/core/resume";
import { mergeIntoProfile, profileFromParse } from "../profile";
import { composeFromProfile } from "./compose";
import { engineer } from "./engineer";
import { getScenario, type Persona } from "./scenario";
import { teacher } from "./teacher";
import type { PersonaFixture } from "./types";

export interface DemoStore {
  persona: Persona;
  empty: boolean;
  profile: CareerProfile | null;
  resumes: Map<string, Resume>;
  history: Map<string, ResumeSnapshot[]>;
  sessions: Map<string, TailoringState>;
  // Resumes that have already had their one simulated "edited in another tab" conflict.
  conflicted: Set<string>;
}

export function fixtureFor(persona: Persona): PersonaFixture {
  return persona === "teacher" ? teacher : engineer;
}

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function answerFacts(
  fx: PersonaFixture,
  answers: { questionId: string; text: string }[],
): { facts: Fact[]; entries: Entry[] } {
  const facts: Fact[] = [];
  const entries: Entry[] = [];
  for (const { questionId, text } of answers) {
    const question = fx.parse.questions.find((q) => q.id === questionId);
    const toFact = fx.answerToFact[questionId];
    const result = toFact ? toFact(text) : { text };
    if (!result) continue;
    if (result.entry) entries.push(result.entry);
    facts.push({
      id: `fa-${questionId}`,
      entryId: result.entry?.id ?? question?.entryId ?? null,
      text: result.text,
      originalText: text,
      source: "answer",
    });
  }
  return { facts, entries };
}

export function dutyFacts(duties: { text: string; entryId: string }[]): Fact[] {
  return duties.map((d) => ({ id: `fd-${slug(d.text)}`, entryId: d.entryId, text: d.text, source: "duty" as const }));
}

function preload(fx: PersonaFixture): Pick<DemoStore, "profile" | "resumes" | "history"> {
  let profile = profileFromParse(fx.parse, fx.contact, fx.region, null);
  const answered = answerFacts(
    fx,
    Object.entries(fx.sampleAnswers).map(([questionId, text]) => ({ questionId, text })),
  );
  const firstJob = fx.parse.entries.find((e) => e.kind === "job");
  profile = mergeIntoProfile(profile, {
    entries: answered.entries,
    facts: [...answered.facts, ...dutyFacts(firstJob ? fx.sampleDuties.map((text) => ({ text, entryId: firstJob.id })) : [])],
  });

  const id = `res-${fx.persona}`;
  const { resume } = composeFromProfile(profile, fx, { id, title: fx.resumeTitle, fallback: false });
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  return {
    profile,
    resumes: new Map([[id, { ...resume, updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }]]),
    history: new Map([[id, [{ at: twoDaysAgo, note: "Created from your answers", sections: resume.sections }]]]),
  };
}

let store: DemoStore | null = null;

// In memory only: a page refresh starts again from the fixtures. Nothing is written anywhere.
export function getStore(): DemoStore {
  const { persona, empty } = getScenario();
  if (!store || store.persona !== persona || store.empty !== empty) {
    const base = empty
      ? { profile: null, resumes: new Map<string, Resume>(), history: new Map<string, ResumeSnapshot[]>() }
      : preload(fixtureFor(persona));
    store = { persona, empty, ...base, sessions: new Map(), conflicted: new Set() };
  }
  return store;
}
