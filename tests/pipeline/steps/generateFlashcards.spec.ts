import { describe, expect, it } from 'vitest';
import { generateFlashcards, type Requirement } from '@dossier/core';
import { FakeLlmPort } from '../../fixtures/fakes/llm.js';

function req(id: string): Requirement {
  return { id, text: `requirement ${id}`, kind: 'technical', priority: 'must', origin: 'generated', pinned: false, order: 0 };
}

describe('generateFlashcards', () => {
  it('maps model candidates to flashcards with minted ids', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ flashcards: [{ front: 'What is X?', back: 'X is...', requirement_ids: ['r1'] }] });

    const result = await generateFlashcards(llm, [req('r1')]);

    expect(result.flashcards).toEqual([
      { id: 'f1', front: 'What is X?', back: 'X is...', requirement_ids: ['r1'], origin: 'generated', pinned: false, order: 0 },
    ]);
  });

  it('drops a requirement id the model invents', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ flashcards: [{ front: 'f', back: 'b', requirement_ids: ['r1', 'r-invented'] }] });

    const result = await generateFlashcards(llm, [req('r1')]);
    expect(result.flashcards[0]?.requirement_ids).toEqual(['r1']);
  });

  it('skips the LLM call entirely for an empty requirement list', async () => {
    const llm = new FakeLlmPort();
    const result = await generateFlashcards(llm, []);
    expect(result.flashcards).toEqual([]);
    expect(llm.calls).toHaveLength(0);
  });
});
