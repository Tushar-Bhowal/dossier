import type { Contact } from "@dossier/core/resume";

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

// The first line of an imported resume is usually the name; only trusted when it looks like one.
export function guessName(text: string): string {
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const words = first.split(/\s+/);
  if (!/^[\p{L} .'-]{2,60}$/u.test(first) || words.length < 2 || words.length > 4) return "";
  return first === first.toUpperCase() ? words.map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ") : first;
}
