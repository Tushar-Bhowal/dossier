import type { CareerProfile, Section, SectionKind } from '../../contracts/resume.js';

export const SECTION_TITLES: Record<SectionKind, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  volunteer: 'Volunteer Experience',
  languages: 'Languages',
};

const EXPERIENCED_ORDER: SectionKind[] = [
  'summary',
  'experience',
  'projects',
  'skills',
  'education',
  'certifications',
  'volunteer',
  'languages',
];

const FRESHER_ORDER: SectionKind[] = [
  'summary',
  'education',
  'projects',
  'skills',
  'experience',
  'certifications',
  'volunteer',
  'languages',
];

export function isFresher(profile: Pick<CareerProfile, 'entries'>): boolean {
  return !profile.entries.some((e) => e.kind === 'job');
}

export function defaultSectionOrder(profile: Pick<CareerProfile, 'entries'>): SectionKind[] {
  return isFresher(profile) ? FRESHER_ORDER : EXPERIENCED_ORDER;
}

// Stable: sections of a kind not in the order list keep their relative position at the end.
export function orderSections(sections: Section[], profile: Pick<CareerProfile, 'entries'>): Section[] {
  const order = defaultSectionOrder(profile);
  const rank = (kind: SectionKind) => {
    const i = order.indexOf(kind);
    return i === -1 ? order.length : i;
  };
  return sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => rank(a.section.kind) - rank(b.section.kind) || a.index - b.index)
    .map(({ section }) => section);
}
