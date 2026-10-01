import type { RecruiterTerm } from '../../contracts/resume.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Exact-term match on word boundaries, case-insensitive. Boundaries are "not a letter or digit"
// rather than \b, so terms like "C++", "C#" and "Node.js" match the way a recruiter's search would.
export function termMatches(text: string, term: string): boolean {
  const needle = term.trim();
  if (!needle) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle.toLowerCase())}(?=$|[^a-z0-9])`, 'i');
  return pattern.test(text.toLowerCase());
}

export interface TermCoverage {
  found: RecruiterTerm[];
  missing: RecruiterTerm[];
  mustFound: number;
  mustTotal: number;
}

export function termCoverage(terms: RecruiterTerm[], text: string): TermCoverage {
  const found: RecruiterTerm[] = [];
  const missing: RecruiterTerm[] = [];
  for (const t of terms) (termMatches(text, t.term) ? found : missing).push(t);
  return {
    found,
    missing,
    mustFound: found.filter((t) => t.priority === 'must').length,
    mustTotal: terms.filter((t) => t.priority === 'must').length,
  };
}
