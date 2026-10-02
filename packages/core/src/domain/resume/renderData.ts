import {
  DEFAULT_LAYOUT,
  type CareerProfile,
  type Contact,
  type Entry,
  type PersonalDetails,
  type Photo,
  type Resume,
  type ResumeLayout,
  type SectionKind,
} from '../../contracts/resume.js';

export interface RenderLink {
  text: string;
  href: string;
}

export interface RenderItem {
  title: string;
  org?: string;
  place?: string;
  dates: string;
  grade?: string;
  credentialId?: string;
  link?: RenderLink;
  bullets: string[];
}

export interface RenderSection {
  title: string;
  kind: SectionKind;
  spaceBefore: number;
  text?: string;
  items?: RenderItem[];
  // Every skill or language, flattened — what text consumers read even when groups are shown.
  list?: string[];
  groups?: { title: string; items: string[] }[];
  pairs?: { label: string; value: string }[];
  signature?: { name: string; place?: string };
}

export interface ContactPart {
  kind: 'email' | 'phone' | 'location' | 'link';
  text: string;
  href?: string;
}

// What the Typst template and the Word export read — resolved and display-ready.
export interface RenderData {
  contact: Contact;
  // The line under the name, in print order. Email, phone and links carry an href so they're clickable.
  contactLine: ContactPart[];
  photo?: Photo;
  layout: ResumeLayout;
  sections: RenderSection[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

// "https://www.github.com/rahul/" → "github.com/rahul": what a reader needs, without the noise.
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${FULL_MONTHS[Number(month) - 1] ?? ''} ${year}`;
}

function personalPairs(personal: PersonalDetails | undefined): { label: string; value: string }[] {
  if (!personal) return [];
  const pairs: [string, string | undefined][] = [
    ['Date of birth', personal.dateOfBirth ? formatDate(personal.dateOfBirth) : undefined],
    ['Gender', personal.gender],
    ['Nationality', personal.nationality],
    ['Marital status', personal.maritalStatus],
    ["Father's name", personal.fatherName],
  ];
  return pairs
    .filter((p): p is [string, string] => Boolean(p[1]?.trim()))
    .map(([label, value]) => ({ label, value: value.trim() }));
}

function contactLine(contact: Contact): ContactPart[] {
  const parts: ContactPart[] = [];
  if (contact.email) parts.push({ kind: 'email', text: contact.email, href: `mailto:${contact.email}` });
  if (contact.phone) parts.push({ kind: 'phone', text: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, '')}` });
  if (contact.location) parts.push({ kind: 'location', text: contact.location });
  for (const l of contact.links) parts.push({ kind: 'link', text: displayUrl(l.url), href: l.url });
  return parts;
}

export function toRenderData(profile: CareerProfile, resume: Resume): RenderData {
  const entries = new Map(profile.entries.map((e) => [e.id, e]));
  const sections: RenderSection[] = [];

  for (const section of resume.sections) {
    if (section.hidden) continue;
    const base = { title: section.title, kind: section.kind, spaceBefore: section.spaceBefore ?? 0 };

    switch (section.kind) {
      case 'summary':
        if (section.text.trim()) sections.push({ ...base, text: section.text.trim() });
        break;
      case 'skills': {
        const groups = (section.groups ?? [])
          .filter((g) => g.skills.length)
          .map((g) => ({ title: g.title, items: g.skills }));
        const all = [...groups.flatMap((g) => g.items), ...section.skills];
        if (!all.length) break;
        sections.push({
          ...base,
          list: all,
          ...(groups.length
            ? { groups: section.skills.length ? [...groups, { title: 'Other', items: section.skills }] : groups }
            : {}),
        });
        break;
      }
      case 'languages':
        if (section.languages.length) sections.push({ ...base, list: section.languages });
        break;
      case 'personal': {
        const pairs = personalPairs(profile.personal);
        if (pairs.length) sections.push({ ...base, pairs });
        break;
      }
      case 'declaration':
        if (section.text.trim()) {
          sections.push({
            ...base,
            text: section.text.trim(),
            signature: {
              name: profile.contact.name,
              ...(profile.contact.location ? { place: profile.contact.location } : {}),
            },
          });
        }
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
            ...(entry.grade ? { grade: entry.grade } : {}),
            ...(entry.credentialId ? { credentialId: entry.credentialId } : {}),
            ...(entry.link ? { link: { text: displayUrl(entry.link), href: entry.link } } : {}),
            bullets: block.bullets.map((b) => b.text.trim()).filter(Boolean),
          });
        }
        if (items.length) sections.push({ ...base, items });
      }
    }
  }

  return {
    contact: profile.contact,
    contactLine: contactLine(profile.contact),
    ...(resume.showPhoto && profile.photo ? { photo: profile.photo } : {}),
    layout: resume.layout ?? DEFAULT_LAYOUT,
    sections,
  };
}

function itemDetails(item: RenderItem): string[] {
  return [
    item.grade ? `Grade: ${item.grade}` : '',
    item.credentialId ? `ID: ${item.credentialId}` : '',
    item.link?.text ?? '',
  ].filter(Boolean);
}

// Plain text in reading order — what term matching and the ATS preview compare against.
export function renderDataText(data: RenderData): string {
  const lines: string[] = [data.contact.name];
  for (const section of data.sections) {
    lines.push(section.title);
    if (section.text) lines.push(section.text);
    if (section.groups) lines.push(...section.groups.map((g) => `${g.title}: ${g.items.join(', ')}`));
    else if (section.list) lines.push(section.list.join(', '));
    for (const pair of section.pairs ?? []) lines.push(`${pair.label}: ${pair.value}`);
    if (section.signature) lines.push(section.signature.name);
    for (const item of section.items ?? []) {
      lines.push([item.title, item.org, item.place, item.dates].filter(Boolean).join(' '));
      lines.push(...itemDetails(item));
      lines.push(...item.bullets);
    }
  }
  return lines.join('\n');
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

// For pasting into an AI chat: headings tell the model which part is which, and it costs a fraction
// of the tokens a PDF does. `forAi` leaves out what identifies the person — email, phone, personal
// details and credential numbers — since a reviewer doesn't need them.
export function toMarkdown(data: RenderData, { forAi = false }: { forAi?: boolean } = {}): string {
  const contactParts = data.contactLine
    .filter((p) => !forAi || (p.kind !== 'email' && p.kind !== 'phone'))
    .map((p) => (p.kind === 'link' && p.href ? `[${p.text}](${p.href})` : p.text));

  const out: string[] = [`# ${oneLine(data.contact.name)}`];
  if (contactParts.length) out.push('', contactParts.join(' | '));

  for (const section of data.sections) {
    if (forAi && section.kind === 'personal') continue;
    out.push('', `## ${oneLine(section.title)}`, '');
    if (section.text) out.push(oneLine(section.text));
    if (section.groups) out.push(...section.groups.map((g) => `- **${oneLine(g.title)}:** ${g.items.map(oneLine).join(', ')}`));
    else if (section.list) out.push(section.list.map(oneLine).join(', '));
    for (const pair of section.pairs ?? []) out.push(`- ${pair.label}: ${oneLine(pair.value)}`);
    if (section.signature) out.push('', oneLine(section.signature.name));
    section.items?.forEach((item, i) => {
      if (i > 0) out.push('');
      out.push(`### ${[item.title, item.org, item.place].filter(Boolean).map((p) => oneLine(p!)).join(', ')}`);
      if (item.dates) out.push(item.dates);
      if (item.grade) out.push(`Grade: ${oneLine(item.grade)}`);
      if (item.credentialId && !forAi) out.push(`ID: ${oneLine(item.credentialId)}`);
      if (item.link) out.push(`[${item.link.text}](${item.link.href})`);
      if (item.bullets.length) out.push('', ...item.bullets.map((b) => `- ${oneLine(b)}`));
    });
  }
  return out.join('\n') + '\n';
}
