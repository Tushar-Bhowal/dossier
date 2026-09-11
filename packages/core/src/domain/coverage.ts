import type { Requirement, Question } from '../contracts/kit.js';

export interface CoverageResult {
  uncovered_requirement_ids: string[];
  uncoveredMusts: string[];
}

export function checkCoverage(requirements: Requirement[], questions: Question[]): CoverageResult {
  const known = new Set(requirements.map((r) => r.id));
  // Dangling refs (a question pointing at a requirement id that doesn't exist) are dropped here,
  // before the difference is taken — otherwise they'd have no effect anyway, but stripping first
  // makes that guarantee explicit rather than incidental.
  const covered = new Set(questions.flatMap((q) => q.requirement_ids).filter((id) => known.has(id)));
  const uncovered = requirements.filter((r) => !covered.has(r.id));

  return {
    uncovered_requirement_ids: uncovered.map((r) => r.id),
    uncoveredMusts: uncovered.filter((r) => r.priority === 'must').map((r) => r.id),
  };
}
