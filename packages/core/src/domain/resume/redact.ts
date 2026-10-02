import type { Entry } from '../../contracts/resume.js';

export type RedactedKind = 'email' | 'phone' | 'link';

export interface RedactedItem {
  kind: RedactedKind;
  value: string;
  token: string;
}

export interface Redaction {
  text: string;
  items: RedactedItem[];
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LINK = /\b(?:https?:\/\/|www\.)[^\s)>\]]+|\b(?:linkedin\.com|github\.com)\/[^\s)>\]]+/gi;
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{7,}\d/g;

function digitCount(value: string): number {
  return value.replace(/\D/g, '').length;
}

// Emails first so the link pattern can't swallow them, then links, then phones. A phone needs
// 10–15 digits, which keeps year ranges like "2019 - 2023" out.
export function redact(input: string): Redaction {
  const items: RedactedItem[] = [];
  const counters: Record<RedactedKind, number> = { email: 0, phone: 0, link: 0 };

  const swap = (kind: RedactedKind, value: string) => {
    const existing = items.find((i) => i.kind === kind && i.value === value);
    if (existing) return existing.token;
    counters[kind] += 1;
    const token = `[${kind.toUpperCase()}_${counters[kind]}]`;
    items.push({ kind, value, token });
    return token;
  };

  let text = input.replace(EMAIL, (m) => swap('email', m));
  text = text.replace(LINK, (m) => swap('link', m));
  text = text.replace(PHONE_CANDIDATE, (m) => {
    const digits = digitCount(m);
    return digits >= 10 && digits <= 15 ? swap('phone', m.trim()) : m;
  });

  return { text, items };
}

export function restore(text: string, items: RedactedItem[]): string {
  return items.reduce((out, item) => out.split(item.token).join(item.value), text);
}

// Entries sent with a prompt lose the fields that identify a person or point at their accounts.
export function entriesForPrompt(entries: Entry[]): Entry[] {
  return entries.map(({ link: _link, credentialId: _id, ...rest }) => rest);
}
