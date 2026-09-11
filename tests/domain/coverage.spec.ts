import { describe, expect, it } from 'vitest';
import { checkCoverage, type Requirement, type Question } from '@dossier/core';

function requirement(id: string, priority: 'must' | 'nice' = 'must'): Requirement {
  return {
    id,
    text: `Requirement ${id}`,
    kind: 'technical',
    priority,
    origin: 'generated',
    pinned: false,
    order: 0,
  };
}

function question(id: string, requirement_ids: string[]): Question {
  return {
    id,
    requirement_ids,
    category: 'technical',
    prompt: `Question ${id}`,
    answer_outline: '',
    difficulty: 1,
    origin: 'generated',
    pinned: false,
    order: 0,
  };
}

describe('checkCoverage', () => {
  it('reports a requirement with no covering question as uncovered', () => {
    const result = checkCoverage([requirement('r1'), requirement('r2')], [question('q1', ['r1'])]);
    expect(result.uncovered_requirement_ids).toEqual(['r2']);
  });

  it('reports full coverage as empty arrays', () => {
    const result = checkCoverage([requirement('r1'), requirement('r2')], [
      question('q1', ['r1']),
      question('q2', ['r2']),
    ]);
    expect(result.uncovered_requirement_ids).toEqual([]);
    expect(result.uncoveredMusts).toEqual([]);
  });

  it('strips dangling requirement_ids before computing coverage, without crashing', () => {
    const result = checkCoverage([requirement('r1')], [question('q1', ['r99', 'r100'])]);
    expect(result.uncovered_requirement_ids).toEqual(['r1']);
  });

  it('a real requirement is still covered even when the same question also references a dangling id', () => {
    const result = checkCoverage([requirement('r1')], [question('q1', ['r1', 'r99'])]);
    expect(result.uncovered_requirement_ids).toEqual([]);
  });

  it('separates uncovered musts from uncovered nices', () => {
    const result = checkCoverage(
      [requirement('r1', 'must'), requirement('r2', 'nice')],
      [],
    );
    expect(result.uncovered_requirement_ids.sort()).toEqual(['r1', 'r2']);
    expect(result.uncoveredMusts).toEqual(['r1']);
  });

  it('treats an empty questions array as every requirement uncovered', () => {
    const result = checkCoverage([requirement('r1'), requirement('r2', 'nice')], []);
    expect(result.uncovered_requirement_ids.sort()).toEqual(['r1', 'r2']);
    expect(result.uncoveredMusts).toEqual(['r1']);
  });

  it('treats an empty requirements array as trivially fully covered', () => {
    const result = checkCoverage([], [question('q1', ['r1'])]);
    expect(result.uncovered_requirement_ids).toEqual([]);
    expect(result.uncoveredMusts).toEqual([]);
  });

  it('a requirement covered by more than one question is still just covered once', () => {
    const result = checkCoverage([requirement('r1')], [question('q1', ['r1']), question('q2', ['r1'])]);
    expect(result.uncovered_requirement_ids).toEqual([]);
  });
});
