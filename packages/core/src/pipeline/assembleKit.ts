import type { Clock } from '../ports/clock.js';
import type { Kit } from '../contracts/kit.js';
import { deriveCompanyName } from '../domain/companyName.js';
import type { PipelineContext } from './definition.js';

const SENIOR_PATTERN = /\b(senior|staff|principal|lead|architect)\b/i;

// The JD's own first line is almost always its title, and a "Location:" line is a common
// convention — both are honest, extracted facts. Anything not actually found says so plainly
// rather than guessing (§5's "never invent" applied to the fields extraction doesn't cover).
// Postings routinely open with a section heading rather than the job title, so taking line 1
// verbatim yields titles like "About The Role:". Headings are skipped, then the title is read from
// the posting's own phrasing — and when neither is there it says so instead of promoting a sentence.
const HEADING_PATTERN =
  /^(about|job|role|position|overview|summary|introduction|responsibilities|key responsibilities|requirements|qualifications|what you|who you|description)\b/i;

const TITLE_FROM_SENTENCE =
  /\b(?:looking for|hiring|seeking|recruiting)\s+(?:an?\s+)?([^.,\n]{3,60}?)(?=\s+(?:who|whom|that|to|with|for|in|at)\b|[.,\n])/i;

function looksLikeHeading(line: string): boolean {
  return line.endsWith(':') || HEADING_PATTERN.test(line);
}

function looksLikeTitle(line: string): boolean {
  // A title is a short noun phrase, not prose: sentence punctuation or a narrative opener means
  // we are looking at the body copy, not the role name.
  return line.length <= 80 && !line.endsWith('.') && !/^(we|you|our|the team|this role)\b/i.test(line);
}

export function deriveRoleTitle(jdText: string): string {
  const lines = jdText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // A real title, when present, is at the very top — scanning deeper starts matching bullet points.
  for (const line of lines.slice(0, 3)) {
    if (!looksLikeHeading(line) && looksLikeTitle(line)) return line;
  }

  const fromSentence = jdText.match(TITLE_FROM_SENTENCE)?.[1]?.trim();
  return fromSentence && fromSentence.length > 0 ? fromSentence : 'Not specified';
}

function deriveLocation(jdText: string): string {
  const match = jdText.match(/location\s*:?\s*([^\n]+)/i);
  return match ? match[1]!.trim() : 'Not specified';
}

// Turns a completed pipeline context into the exact Appendix A shape. Shared by the batch CLI
// (Task 19) and, later, the API's run-completion path (Task 22) — one assembly, not two.
export function assembleKit(input: { jdText: string; companyUrl: string; daysAvailable: number }, ctx: PipelineContext, clock: Clock): Kit {
  const brief = ctx.companyBrief ?? {
    summary: 'No company brief was generated for this run.',
    what_they_do: 'Unknown.',
    sources: [],
    origin: 'generated' as const,
  };

  return {
    source: {
      company: deriveCompanyName(input.companyUrl),
      company_url: input.companyUrl,
      role: deriveRoleTitle(input.jdText),
      location: deriveLocation(input.jdText),
      jd_chars: input.jdText.length,
      researched_at: clock.now().toISOString(),
      pages_used: brief.sources,
    },
    company_brief: brief,
    role: {
      title: deriveRoleTitle(input.jdText),
      seniority: SENIOR_PATTERN.test(input.jdText) ? 'Senior' : 'Not specified',
      // No dedicated responsibilities-extraction step exists in this phase — reported honestly
      // empty rather than invented from the requirements list.
      responsibilities: [],
      requirements: ctx.requirements,
    },
    questions: ctx.questions,
    flashcards: ctx.flashcards,
    schedule: ctx.schedule ?? { days_available: input.daysAvailable, days: [] },
    coverage: {
      uncovered_requirement_ids: ctx.uncoveredRequirementIds,
      passes: ctx.coveragePasses,
    },
  };
}
