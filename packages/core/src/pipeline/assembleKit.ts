import type { Clock } from '../ports/clock.js';
import type { Kit } from '../contracts/kit.js';
import type { PipelineContext } from './definition.js';

const SENIOR_PATTERN = /\b(senior|staff|principal|lead|architect)\b/i;

function deriveCompanyName(companyUrl: string): string {
  try {
    const hostname = new URL(companyUrl).hostname.replace(/^www\./, '');
    const label = hostname.split('.')[0] ?? hostname;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'Unknown company';
  }
}

// The JD's own first line is almost always its title, and a "Location:" line is a common
// convention — both are honest, extracted facts. Anything not actually found says so plainly
// rather than guessing (§5's "never invent" applied to the fields extraction doesn't cover).
function deriveRoleTitle(jdText: string): string {
  const firstLine = jdText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine && firstLine.length <= 120 ? firstLine : 'Not specified';
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
