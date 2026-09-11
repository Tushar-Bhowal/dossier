import { describe, expect, it } from 'vitest';
import { fillCoverageGaps, type Requirement } from '@dossier/core';
import { FakeLlmPort } from '../../fixtures/fakes/llm.js';

function req(id: string, priority: Requirement['priority'], kind: Requirement['kind'] = 'technical'): Requirement {
  return { id, text: `requirement ${id}`, kind, priority, origin: 'generated', pinned: false, order: 0 };
}

describe('fillCoverageGaps', () => {
  it('does nothing and runs zero passes when every must is already covered', async () => {
    const llm = new FakeLlmPort();
    const requirements = [req('r1', 'must')];
    const initialQuestions = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical' as const,
        prompt: 'p',
        answer_outline: '',
        difficulty: 1 as const,
        origin: 'generated' as const,
        pinned: false,
        order: 0,
      },
    ];

    const result = await fillCoverageGaps(llm, requirements, initialQuestions);

    expect(result.passes).toBe(0);
    expect(result.questions).toEqual(initialQuestions);
    expect(llm.calls).toHaveLength(0);
  });

  it('closes an uncovered must-have on the second pass', async () => {
    const llm = new FakeLlmPort();
    // Pass 1: model writes a question that misses the target (invalid/irrelevant requirement id).
    llm.enqueue({ questions: [{ prompt: 'off target', answer_outline: '', difficulty: 1, requirement_ids: [] }] });
    // Pass 2: model gets it right.
    llm.enqueue({
      questions: [{ prompt: 'on target', answer_outline: '', difficulty: 2, requirement_ids: ['r1'] }],
    });

    const requirements = [req('r1', 'must')];
    const result = await fillCoverageGaps(llm, requirements, []);

    expect(result.passes).toBe(2);
    expect(result.uncoveredRequirementIds).toEqual([]);
    expect(result.questions.some((q) => q.prompt === 'on target' && q.origin === 'generated')).toBe(true);
  });

  it('mints question ids that continue after the existing question ids, never colliding', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ questions: [{ prompt: 'new', answer_outline: '', difficulty: 1, requirement_ids: ['r2'] }] });

    const requirements = [req('r1', 'nice'), req('r2', 'must')];
    const existing = [
      {
        id: 'q3',
        requirement_ids: ['r1'],
        category: 'technical' as const,
        prompt: 'existing',
        answer_outline: '',
        difficulty: 1 as const,
        origin: 'generated' as const,
        pinned: false,
        order: 0,
      },
    ];

    const result = await fillCoverageGaps(llm, requirements, existing);
    const newQuestion = result.questions.find((q) => q.prompt === 'new');
    expect(newQuestion?.id).toBe('q4');
  });

  it('synthesizes a deterministic template question when a must is still uncovered after 3 passes', async () => {
    const llm = new FakeLlmPort();
    for (let i = 0; i < 3; i += 1) {
      llm.enqueue({ questions: [{ prompt: `attempt ${i}`, answer_outline: '', difficulty: 1, requirement_ids: [] }] });
    }

    const requirements = [req('r1', 'must')];
    const result = await fillCoverageGaps(llm, requirements, []);

    expect(result.passes).toBe(3);
    expect(result.uncoveredRequirementIds).toEqual([]);
    const templateQuestion = result.questions.find((q) => q.origin === 'template');
    expect(templateQuestion).toBeDefined();
    expect(templateQuestion?.requirement_ids).toEqual(['r1']);
    expect(llm.calls).toHaveLength(3);
  });

  it('never chases an uncovered nice-to-have once all musts are covered', async () => {
    const llm = new FakeLlmPort();
    const requirements = [req('r1', 'must'), req('r2', 'nice')];
    const initialQuestions = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical' as const,
        prompt: 'p',
        answer_outline: '',
        difficulty: 1 as const,
        origin: 'generated' as const,
        pinned: false,
        order: 0,
      },
    ];

    const result = await fillCoverageGaps(llm, requirements, initialQuestions);

    expect(result.passes).toBe(0);
    expect(result.uncoveredRequirementIds).toEqual(['r2']);
    expect(llm.calls).toHaveLength(0);
  });
});
