import {
  SECTION_TITLES,
  orderSections,
  type Bullet,
  type CareerProfile,
  type ComposeResult,
  type EntryKind,
  type EntrySectionKind,
  type Fact,
  type Section,
} from "@dossier/core/resume";
import type { PersonaFixture } from "./types";

const SECTION_FOR_ENTRY: Record<EntryKind, EntrySectionKind> = {
  job: "experience",
  education: "education",
  project: "projects",
  certification: "certifications",
  volunteer: "volunteer",
};

// Only experience, projects and volunteer entries carry bullets; education and certifications are
// listed by their titles, with the facts kept as backing.
const BULLETED: EntrySectionKind[] = ["experience", "projects", "volunteer"];

function polish(text: string): string {
  const trimmed = text.trim().replace(/\.$/, "");
  const verbFixed = trimmed.replace(/^Teaches\b/, "Teach").replace(/^Uses\b/, "Use");
  return verbFixed.charAt(0).toUpperCase() + verbFixed.slice(1);
}

function phrase(fact: Fact, fx: PersonaFixture): string {
  if (fx.factBullets[fact.id]) return fx.factBullets[fact.id]!;
  if (fact.source === "duty" && fx.dutyBullets[fact.text]) return fx.dutyBullets[fact.text]!;
  return polish(fact.text);
}

// Stands in for the compose call: every bullet comes from exactly one confirmed fact, with stable
// ids (`b-<factId>`) so the tailoring fixtures can point at them.
export function composeFromProfile(
  profile: CareerProfile,
  fx: PersonaFixture,
  { id, title, fallback }: { id: string; title: string; fallback: boolean },
): ComposeResult {
  const sections: Section[] = [];
  const factIds = new Set(profile.facts.map((f) => f.id));
  const summaryFacts = fx.summary.factIds.filter((fid) => factIds.has(fid));

  sections.push({
    id: `${id}-summary`,
    kind: "summary",
    title: SECTION_TITLES.summary,
    hidden: false,
    text: summaryFacts.length ? fx.summary.text : "",
    factIds: summaryFacts,
  });

  const fallbackIds: string[] = [];

  for (const kind of ["experience", "projects", "education", "certifications", "volunteer"] as const) {
    const entries = profile.entries.filter((e) => SECTION_FOR_ENTRY[e.kind] === kind);
    if (!entries.length) continue;
    sections.push({
      id: `${id}-${kind}`,
      kind,
      title: SECTION_TITLES[kind],
      hidden: false,
      items: entries.map((entry) => ({
        entryId: entry.id,
        bullets: BULLETED.includes(kind)
          ? profile.facts
              .filter((f) => f.entryId === entry.id)
              .map((fact): Bullet => {
                const text = phrase(fact, fx);
                const useFallback = fallback && kind === "experience" && fallbackIds.length < 2 && text !== polish(fact.text);
                if (useFallback) fallbackIds.push(`b-${fact.id}`);
                return {
                  id: `b-${fact.id}`,
                  text: useFallback ? polish(fact.text) : text,
                  factIds: [fact.id],
                  origin: useFallback ? "fallback" : "ai",
                };
              })
          : [],
      })),
    });
  }

  if (profile.skills.length) {
    sections.push({
      id: `${id}-skills`,
      kind: "skills",
      title: SECTION_TITLES.skills,
      hidden: false,
      skills: profile.skills.map((s) => s.name),
    });
  }
  if (profile.languages.length) {
    sections.push({
      id: `${id}-languages`,
      kind: "languages",
      title: SECTION_TITLES.languages,
      hidden: false,
      languages: profile.languages,
    });
  }

  return {
    resume: {
      id,
      title,
      template: "universal",
      showPhoto: false,
      sections: orderSections(sections, profile),
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    fallbackBulletIds: fallbackIds,
  };
}
