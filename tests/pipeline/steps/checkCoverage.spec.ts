import { describe, expect, it } from 'vitest';
import { evaluateCoverage, type Question, type Requirement } from '@dossier/core';

function req(id: string, priority: Requirement['priority']): Requirement {
  return { id, text: id, kind: 'technical', priority, origin: 'generated', pinned: false, order: 0 };
}

function question(id: string, requirementIds: string[]): Question {
  return {
    id,
    requirement_ids: requirementIds,
    category: 'technical',
    prompt: id,
    answer_outline: '',
    difficulty: 1,
    origin: 'generated',
    pinned: false,
    order: 0,
  };
}

describe('checkCoverage (step)', () => {
  it('reports allMustsCovered true when every must has a covering question', () => {
    const result = evaluateCoverage([req('r1', 'must'), req('r2', 'nice')], [question('q1', ['r1'])]);
    expect(result.allMustsCovered).toBe(true);
    expect(result.uncoveredRequirementIds).toEqual(['r2']);
  });

  it('reports allMustsCovered false and lists the uncovered musts', () => {
    const result = evaluateCoverage([req('r1', 'must'), req('r2', 'must')], [question('q1', ['r1'])]);
    expect(result.allMustsCovered).toBe(false);
    expect(result.uncoveredMustIds).toEqual(['r2']);
  });
});
