import type { Contact, RedactedKind, Redaction } from "@dossier/core/resume";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactErrors = Partial<Record<"name" | "email" | "link", string>>;

export function normaliseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

export function contactErrors(contact: Contact, link: string): ContactErrors {
  const errors: ContactErrors = {};
  if (!contact.name.trim()) errors.name = "Your name goes at the top of the resume.";
  if (contact.email && !EMAIL.test(contact.email.trim())) errors.email = "This doesn't look like an email address.";
  if (link.trim() && !normaliseUrl(link)) errors.link = "This doesn't look like a web address.";
  return errors;
}

export function linkLabel(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host.includes("linkedin")) return "LinkedIn";
  if (host.includes("github")) return "GitHub";
  return "Website";
}

export function withLink(contact: Contact, link: string): Contact {
  const url = normaliseUrl(link);
  return { ...contact, name: contact.name.trim(), links: url ? [{ label: linkLabel(url), url }] : [] };
}

const NOT_A_NAME = /^(resume|cv|curriculum vitae|bio-?data|profile|contact)$/i;
const NAME_LABEL = /^(?:full\s+)?name\s*[:\-–]\s*(.+)$/i;

function nameLike(line: string): string {
  const words = line.split(/\s+/);
  if (NOT_A_NAME.test(line) || !/^[\p{L} .'-]{2,60}$/u.test(line) || words.length < 2 || words.length > 4) return "";
  return line === line.toUpperCase() ? words.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ") : line;
}

// A resume usually opens with the name, sometimes under a "Resume" title or as "Name: …". Only
// trusted when it looks like a name — an empty field beats a wrong one.
export function guessName(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
  for (const line of lines) {
    const labelled = NAME_LABEL.exec(line)?.[1]?.trim();
    const name = nameLike(labelled ?? line);
    if (name) return name;
  }
  return "";
}

// Contact details found in what the user sent — taken from the redaction, so they're the exact
// values that were hidden from the AI.
export function contactFromText(original: string, redaction: Redaction): { contact: Contact; link: string } {
  const find = (kind: RedactedKind) => redaction.items.find((i) => i.kind === kind)?.value;
  const email = find("email");
  const phone = find("phone");
  return {
    contact: { name: guessName(original), links: [], ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
    link: find("link") ?? "",
  };
}

const HEADING =
  /^(work\s+)?(experience|employment(\s+history)?|education(al)?(\s+qualifications?)?|qualifications?|skills|technical skills|key skills|projects|certifications?|summary|professional summary|objective|career objective|profile|achievements|languages|internships?|training|personal details|declaration|hobbies)\s*:?$/i;

// Pasted resumes go to the import path (built for a full resume, 20k characters) instead of the
// "describe yourself" path. Long text goes there too: the describe request stops at 4,000.
export function looksLikeResume(text: string): boolean {
  if (text.length > 4000) return true;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (text.length < 250 || lines.length < 6) return false;
  const headings = lines.filter((l) => l.length <= 40 && HEADING.test(l)).length;
  const contact = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text) || /\+?\d[\d\s().-]{8,}\d/.test(text);
  return headings >= 2 || (headings >= 1 && contact);
}
