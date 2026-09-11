import { checkCoverage } from '../../domain/coverage.js';
import type { Question, Requirement } from '../../contracts/kit.js';

export interface CheckCoverageResult {
  uncoveredRequirementIds: string[];
  uncoveredMustIds: string[];
  allMustsCovered: boolean;
}

// Thin step-level wrapper around the pure domain function (no LLM) — the gap-fill loop (Task 17)
// needs "are all musts covered yet?" as its own stop-condition check, not just the raw set diff.
// Named differently from domain/coverage.ts's `checkCoverage` it wraps, so both can be exported
// from the package's public surface (packages/core/src/index.ts) without an ambiguous collision.
export function evaluateCoverage(requirements: Requirement[], questions: Question[]): CheckCoverageResult {
  const { uncovered_requirement_ids, uncoveredMusts } = checkCoverage(requirements, questions);
  return {
    uncoveredRequirementIds: uncovered_requirement_ids,
    uncoveredMustIds: uncoveredMusts,
    allMustsCovered: uncoveredMusts.length === 0,
  };
}
