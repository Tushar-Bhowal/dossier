import { describe, expect, it } from 'vitest';
import { generateQuestions, type Requirement } from '@dossier/core';
import { FakeLlmPort } from '../../fixtures/fakes/llm.js';

function req(id: string, kind: Requirement['kind']): Requirement {
  return { id, text: `req ${id}`, kind, priority: 'must', origin: 'generated', pinned: false, order: 0 };
}

const BASE_BRIEF = { summary: 's', what_they_do: 'd', sources: [], origin: 'generated' as const };

describe('generateQuestions', () => {
  it('makes one call per populated category, with distinct prompts', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ questions: [{ prompt: 'tech q', answer_outline: '', difficulty: 1, requirement_ids: ['r1'] }] });
    llm.enqueue({ questions: [{ prompt: 'behav q', answer_outline: '', difficulty: 1, requirement_ids: ['r2'] }] });
    llm.enqueue({ questions: [{ prompt: 'fit q', answer_outline: '', difficulty: 1, requirement_ids: [] }] });

    const result = await generateQuestions(llm, {
      jdText: 'Backend Engineer role.',
      requirements: [req('r1', 'technical'), req('r2', 'behavioural')],
      brief: BASE_BRIEF,
      hiringPages: [],
      searchResults: [],
    });

    expect(llm.calls).toHaveLength(3);
    expect(result.questions.map((q) => q.category)).toEqual(['technical', 'behavioural', 'company-fit']);
    expect(result.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
    expect(result.questions.map((q) => q.order)).toEqual([0, 1, 2]);
    // prompts differ meaningfully between calls
    const prompts = llm.calls.map((c) => c.prompt);
    expect(new Set(prompts).size).toBe(3);
  });

  it('skips a category with no matching requirements, without calling the model for it', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ questions: [{ prompt: 'tech q', answer_outline: '', difficulty: 1, requirement_ids: ['r1'] }] });
    llm.enqueue({ questions: [] }); // company-fit

    const result = await generateQuestions(llm, {
      jdText: 'Backend Engineer role.',
      requirements: [req('r1', 'technical')],
      brief: BASE_BRIEF,
      hiringPages: [],
      searchResults: [],
    });

    expect(llm.calls).toHaveLength(2);
    expect(result.questions.some((q) => q.category === 'behavioural')).toBe(false);
  });

  it('generates system-design questions only when the JD reads senior AND technical density is high enough', async () => {
    const technicalReqs = [req('r1', 'technical'), req('r2', 'technical'), req('r3', 'technical')];

    const llmSenior = new FakeLlmPort();
    llmSenior.enqueue({ questions: [{ prompt: 't', answer_outline: '', difficulty: 1, requirement_ids: [] }] }); // technical
    llmSenior.enqueue({ questions: [{ prompt: 'sd', answer_outline: '', difficulty: 3, requirement_ids: [] }] }); // system-design
    llmSenior.enqueue({ questions: [{ prompt: 'fit', answer_outline: '', difficulty: 1, requirement_ids: [] }] }); // company-fit

    const seniorResult = await generateQuestions(llmSenior, {
      jdText: 'Senior Backend Engineer role.',
      requirements: technicalReqs,
      brief: BASE_BRIEF,
      hiringPages: [],
      searchResults: [],
    });
    expect(seniorResult.questions.some((q) => q.category === 'system-design')).toBe(true);

    const llmJunior = new FakeLlmPort();
    llmJunior.enqueue({ questions: [{ prompt: 't', answer_outline: '', difficulty: 1, requirement_ids: [] }] }); // technical
    llmJunior.enqueue({ questions: [{ prompt: 'fit', answer_outline: '', difficulty: 1, requirement_ids: [] }] }); // company-fit

    const juniorResult = await generateQuestions(llmJunior, {
      jdText: 'Backend Engineer role.', // not senior-sounding
      requirements: technicalReqs,
      brief: BASE_BRIEF,
      hiringPages: [],
      searchResults: [],
    });
    expect(juniorResult.questions.some((q) => q.category === 'system-design')).toBe(false);
  });

  it('drops a requirement id the model invents that was never given to it', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({
      questions: [{ prompt: 'tech q', answer_outline: '', difficulty: 1, requirement_ids: ['r1', 'r-invented'] }],
    });
    llm.enqueue({ questions: [] }); // company-fit

    const result = await generateQuestions(llm, {
      jdText: 'Engineer role.',
      requirements: [req('r1', 'technical')],
      brief: BASE_BRIEF,
      hiringPages: [],
      searchResults: [],
    });

    expect(result.questions[0]?.requirement_ids).toEqual(['r1']);
  });
});
