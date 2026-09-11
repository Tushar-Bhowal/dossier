import type { Requirement } from '../contracts/kit.js';

export interface RawRequirementCandidate {
  text: string;
  kind: Requirement['kind'];
  priority: Requirement['priority'];
  // Verbatim span from the JD the model claims backs this requirement. Transient — used here to
  // verify and to correct priority, then discarded. Never reaches the kit, the database, or any
  // API response; see the NOTE in contracts/kit.ts for why it isn't a persisted field.
  quote: string;
}

export type RequirementCandidate = Omit<RawRequirementCandidate, 'quote'>;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

const MUST_PATTERNS = [/\brequired\b/i, /\bmust[- ]have\b/i, /\byou have\b/i, /\bwe need\b/i, /\bmust\b/i];
const NICE_PATTERNS = [/\bnice to have\b/i, /\bbonus\b/i, /\bpreferred\b/i, /\ba plus\b/i, /\bdesirable\b/i];

function findEnclosingLine(text: string, quote: string): string {
  const idx = text.toLowerCase().indexOf(quote.toLowerCase());
  if (idx === -1) return quote;
  const lineStart = text.lastIndexOf('\n', idx) + 1;
  const lineEndIdx = text.indexOf('\n', idx + quote.length);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  return text.slice(lineStart, lineEnd);
}

// The lexicon overrides the model's own priority call only when it's decisive — §5 says must vs
// nice comes from how the posting words it, a text property, so code owns it where the wording is
// clear. Checked against the quote's enclosing line (not just the quote itself), so a requirement
// phrased plainly but qualified inline — "5+ years with React (required)" — still resolves
// correctly even if the model's quote only captured "5+ years with React". Where both or neither
// pattern matches, the posting is ambiguous or silent, and the model's own judgment stands.
function priorityFromLexicon(quote: string, jdText: string): 'must' | 'nice' | null {
  const context = findEnclosingLine(jdText, quote);
  const isMust = MUST_PATTERNS.some((p) => p.test(context));
  const isNice = NICE_PATTERNS.some((p) => p.test(context));
  if (isMust && !isNice) return 'must';
  if (isNice && !isMust) return 'nice';
  return null;
}

// The model must return a verbatim quote backing each requirement candidate. If that quote isn't
// actually present in the JD, the candidate is dropped — invention becomes structurally impossible
// instead of merely prompt-discouraged. `quote` never survives past this function.
export function verifyAgainstSource(
  candidates: RawRequirementCandidate[],
  jdText: string,
): RequirementCandidate[] {
  const haystack = normalize(jdText);
  const verified: RequirementCandidate[] = [];

  for (const { quote, ...candidate } of candidates) {
    if (!haystack.includes(normalize(quote))) continue;
    const lexiconPriority = priorityFromLexicon(quote, jdText);
    verified.push({ ...candidate, priority: lexiconPriority ?? candidate.priority });
  }

  return verified;
}
