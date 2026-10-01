import type { CareerProfile, Contact, Entry, Fact, ParseResult, Region, Skill } from "@dossier/core/resume";

export interface ProfileAdditions {
  entries?: Entry[];
  facts?: Fact[];
  skills?: Skill[];
  languages?: string[];
}

// A skill backed by a fact wins over the same skill self-declared.
function mergeSkills(current: Skill[], incoming: Skill[]): Skill[] {
  const byName = new Map(current.map((s) => [s.name.toLowerCase(), s]));
  for (const skill of incoming) {
    const existing = byName.get(skill.name.toLowerCase());
    if (!existing || (existing.source === "self-declared" && skill.source === "fact")) {
      byName.set(skill.name.toLowerCase(), skill);
    }
  }
  return [...byName.values()];
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((x) => [x.id, x]));
  for (const x of incoming) map.set(x.id, x);
  return [...map.values()];
}

export function mergeIntoProfile(profile: CareerProfile, add: ProfileAdditions): CareerProfile {
  return {
    ...profile,
    entries: mergeById(profile.entries, add.entries ?? []),
    facts: mergeById(profile.facts, add.facts ?? []),
    skills: mergeSkills(profile.skills, add.skills ?? []),
    languages: [...new Set([...profile.languages, ...(add.languages ?? [])])],
  };
}

export function profileFromParse(
  parse: ParseResult,
  contact: Contact,
  region: Region,
  existing: CareerProfile | null,
): CareerProfile {
  const base: CareerProfile = existing ?? {
    region,
    contact,
    entries: [],
    facts: [],
    skills: [],
    languages: [],
    skillsToLearn: [],
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  return mergeIntoProfile(
    {
      ...base,
      region,
      contact,
      ...(parse.canonicalRole ? { canonicalRole: parse.canonicalRole } : {}),
    },
    parse,
  );
}
