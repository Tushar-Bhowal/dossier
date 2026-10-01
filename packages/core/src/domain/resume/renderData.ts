import type { CareerProfile, Contact, Entry, Photo, Resume, SectionKind } from '../../contracts/resume.js';

export interface RenderItem {
  title: string;
  org?: string;
  place?: string;
  dates: string;
  bullets: string[];
}

export interface RenderSection {
  title: string;
  kind: SectionKind;
  text?: string;
  items?: RenderItem[];
  list?: string[];
}

// What the Typst template and the Word export read — resolved and display-ready.
export interface RenderData {
  contact: Contact;
  photo?: Photo;
  sections: RenderSection[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatYearMonth(value: string): string {
  const [year, month] = value.split('-');
  if (!month) return year ?? value;
  return `${MONTHS[Number(month) - 1] ?? ''} ${year}`.trim();
}

export function formatDateRange(entry: Pick<Entry, 'start' | 'end' | 'current'>): string {
  const start = entry.start ? formatYearMonth(entry.start) : '';
  const end = entry.current ? 'Present' : entry.end ? formatYearMonth(entry.end) : '';
  if (start && end) return start === end ? start : `${start} – ${end}`;
  return start || end;
}

export function toRenderData(profile: CareerProfile, resume: Resume): RenderData {
  const entries = new Map(profile.entries.map((e) => [e.id, e]));
  const sections: RenderSection[] = [];

  for (const section of resume.sections) {
    if (section.hidden) continue;
    const base = { title: section.title, kind: section.kind };

    switch (section.kind) {
      case 'summary':
        if (section.text.trim()) sections.push({ ...base, text: section.text.trim() });
        break;
      case 'skills':
        if (section.skills.length) sections.push({ ...base, list: section.skills });
        break;
      case 'languages':
        if (section.languages.length) sections.push({ ...base, list: section.languages });
        break;
      default: {
        const items: RenderItem[] = [];
        for (const block of section.items) {
          const entry = entries.get(block.entryId);
          if (!entry) continue;
          items.push({
            title: entry.title,
            ...(entry.org ? { org: entry.org } : {}),
            ...(entry.place ? { place: entry.place } : {}),
            dates: formatDateRange(entry),
            bullets: block.bullets.map((b) => b.text.trim()).filter(Boolean),
          });
        }
        if (items.length) sections.push({ ...base, items });
      }
    }
  }

  return {
    contact: profile.contact,
    ...(resume.showPhoto && profile.photo ? { photo: profile.photo } : {}),
    sections,
  };
}

// Plain text in reading order — what term matching and the ATS preview compare against.
export function renderDataText(data: RenderData): string {
  const lines: string[] = [data.contact.name];
  for (const section of data.sections) {
    lines.push(section.title);
    if (section.text) lines.push(section.text);
    if (section.list) lines.push(section.list.join(', '));
    for (const item of section.items ?? []) {
      lines.push([item.title, item.org, item.place, item.dates].filter(Boolean).join(' '));
      lines.push(...item.bullets);
    }
  }
  return lines.join('\n');
}
