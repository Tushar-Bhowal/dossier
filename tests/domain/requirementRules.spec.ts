import { describe, expect, it } from 'vitest';
import { verifyAgainstSource, type RawRequirementCandidate } from '@dossier/core';

const JD = `Senior Backend Engineer

Requirements:
- 5+ years with React required
- Bonus points for Kubernetes experience
- Experience mentoring junior engineers
`;

function candidate(overrides: Partial<RawRequirementCandidate>): RawRequirementCandidate {
  return {
    text: 'default text',
    kind: 'technical',
    priority: 'nice',
    quote: 'default text',
    ...overrides,
  };
}

describe('verifyAgainstSource', () => {
  it('keeps a candidate whose quote is verbatim in the JD', () => {
    const result = verifyAgainstSource(
      [candidate({ text: '5+ years with React', quote: '5+ years with React required' })],
      JD,
    );
    expect(result).toHaveLength(1);
  });

  it('drops a candidate whose quote is not present in the JD (hallucination guard)', () => {
    const result = verifyAgainstSource(
      [candidate({ text: '10+ years with COBOL', quote: '10+ years with COBOL', priority: 'must' })],
      JD,
    );
    expect(result).toHaveLength(0);
  });

  it('marks "5+ years ... required" as must, overriding a wrong model-supplied priority', () => {
    const result = verifyAgainstSource(
      [
        candidate({
          text: '5+ years with React',
          quote: '5+ years with React required',
          priority: 'nice', // deliberately wrong — the lexicon should correct this
        }),
      ],
      JD,
    );
    expect(result[0]!.priority).toBe('must');
  });

  it('marks "Bonus points for Kubernetes" as nice, overriding a wrong model-supplied priority', () => {
    const result = verifyAgainstSource(
      [
        candidate({
          text: 'Kubernetes experience',
          quote: 'Bonus points for Kubernetes experience',
          priority: 'must', // deliberately wrong — the lexicon should correct this
        }),
      ],
      JD,
    );
    expect(result[0]!.priority).toBe('nice');
  });

  it('the returned candidates carry no quote field', () => {
    const result = verifyAgainstSource(
      [candidate({ text: '5+ years with React', quote: '5+ years with React required' })],
      JD,
    );
    expect(result[0]).not.toHaveProperty('quote');
    expect(Object.keys(result[0]!).sort()).toEqual(['kind', 'priority', 'text']);
  });

  it('leaves the model priority untouched when the wording is ambiguous or silent', () => {
    const result = verifyAgainstSource(
      [
        candidate({
          text: 'mentoring junior engineers',
          quote: 'Experience mentoring junior engineers',
          priority: 'nice',
          kind: 'behavioural',
        }),
      ],
      JD,
    );
    expect(result[0]!.priority).toBe('nice');
  });

  it('matches a quote case-insensitively and tolerant of whitespace differences', () => {
    const result = verifyAgainstSource(
      [candidate({ text: 'React', quote: '5+  YEARS   with react required' })],
      JD,
    );
    expect(result).toHaveLength(1);
  });

  it('processes multiple candidates independently, keeping valid ones and dropping invalid ones', () => {
    const result = verifyAgainstSource(
      [
        candidate({ text: 'React', quote: '5+ years with React required', priority: 'nice' }),
        candidate({ text: 'fabricated', quote: 'fluent in Klingon', priority: 'must' }),
        candidate({ text: 'Kubernetes', quote: 'Bonus points for Kubernetes experience', priority: 'must' }),
      ],
      JD,
    );
    expect(result.map((r) => r.text)).toEqual(['React', 'Kubernetes']);
    expect(result.map((r) => r.priority)).toEqual(['must', 'nice']);
  });
});
