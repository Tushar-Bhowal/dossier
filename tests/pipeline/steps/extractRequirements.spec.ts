import { describe, expect, it } from 'vitest';
import { extractRequirements } from '@dossier/core';
import { FakeLlmPort } from '../../fixtures/fakes/llm.js';

const RICH_JD = `Senior Backend Engineer at Acme.

Requirements:
- 5+ years of experience with distributed systems (required)
- Strong Python skills
- Nice to have: experience with Kubernetes
- Must be able to mentor junior engineers`;

describe('extractRequirements', () => {
  it('marks priority correctly and mints ordered ids for a rich JD', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({
      requirements: [
        {
          text: '5+ years with distributed systems',
          kind: 'technical',
          priority: 'nice',
          quote: '5+ years of experience with distributed systems (required)',
        },
        { text: 'Strong Python skills', kind: 'technical', priority: 'nice', quote: 'Strong Python skills' },
        {
          text: 'Kubernetes experience',
          kind: 'technical',
          priority: 'must',
          quote: 'Nice to have: experience with Kubernetes',
        },
        {
          text: 'Mentor junior engineers',
          kind: 'behavioural',
          priority: 'nice',
          quote: 'Must be able to mentor junior engineers',
        },
      ],
    });

    const result = await extractRequirements(llm, RICH_JD);

    expect(result.thin).toBe(false);
    expect(result.requirements).toHaveLength(4);
    expect(result.requirements.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(result.requirements.map((r) => r.order)).toEqual([0, 1, 2, 3]);
    // The lexicon overrides the model's own (wrong) priority call where the JD's wording is decisive.
    expect(result.requirements[0]?.priority).toBe('must');
    expect(result.requirements[2]?.priority).toBe('nice');
    expect(result.requirements[3]?.priority).toBe('must');
    // No requirement carries a quote field onto the returned type.
    for (const r of result.requirements) {
      expect(r).not.toHaveProperty('quote');
    }
  });

  it('drops a hallucinated candidate whose quote is not actually present in the JD', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({
      requirements: [
        { text: 'Strong Python skills', kind: 'technical', priority: 'nice', quote: 'Strong Python skills' },
        {
          text: 'Must have a PhD in Computer Science',
          kind: 'domain',
          priority: 'must',
          quote: 'Must have a PhD in Computer Science',
        },
      ],
    });

    const result = await extractRequirements(llm, RICH_JD);

    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0]?.text).toBe('Strong Python skills');
  });

  it('produces a small, honest set for a thin JD rather than padding it', async () => {
    const thinJd = 'Backend role. Node.js.';
    const llm = new FakeLlmPort();
    llm.enqueue({
      requirements: [{ text: 'Node.js experience', kind: 'technical', priority: 'nice', quote: 'Node.js' }],
    });

    const result = await extractRequirements(llm, thinJd);

    expect(result.thin).toBe(true);
    expect(result.requirements).toHaveLength(1);
  });
});
