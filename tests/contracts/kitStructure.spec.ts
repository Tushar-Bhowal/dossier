import { describe, expect, it } from 'vitest';
import { Kit, BatchCase, BatchInput, BatchOutput, createIdMinter } from '@dossier/core';

function validKit() {
  return {
    source: {
      company: 'Acme Corp',
      company_url: 'https://acme.example.com',
      role: 'Senior Backend Engineer',
      location: 'Remote',
      jd_chars: 1200,
      researched_at: '2026-09-01T09:12:44Z',
      pages_used: ['https://acme.example.com/careers'],
    },
    company_brief: {
      summary: 'Acme builds widgets.',
      what_they_do: 'B2B widget manufacturing SaaS.',
      sources: ['https://acme.example.com/about'],
      origin: 'generated',
    },
    role: {
      title: 'Senior Backend Engineer',
      seniority: 'Senior',
      responsibilities: ['Own the payments service'],
      requirements: [
        {
          id: 'r1',
          text: '5+ years with React',
          kind: 'technical',
          priority: 'must',
          origin: 'generated',
          pinned: false,
          order: 0,
        },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Describe a time you scaled a payments service.',
        answer_outline: 'Look for concrete metrics and trade-offs.',
        difficulty: 2,
        origin: 'generated',
        pinned: false,
        order: 0,
      },
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'What is idempotency?',
        back: 'An operation that can be applied multiple times without changing the result beyond the first application.',
        requirement_ids: ['r1'],
        origin: 'generated',
        pinned: false,
        order: 0,
      },
    ],
    schedule: {
      days_available: 1,
      days: [{ day: 1, focus: 'Technical fundamentals', question_ids: ['q1'], minutes: 60 }],
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe('Kit contract', () => {
  it('accepts a kit matching Appendix A field names exactly', () => {
    const result = Kit.safeParse(validKit());
    expect(result.success).toBe(true);
  });

  it('rejects a float for schedule minutes', () => {
    const kit = validKit();
    kit.schedule.days[0]!.minutes = 60.5;
    const result = Kit.safeParse(kit);
    expect(result.success).toBe(false);
  });

  it('rejects a schedule question_ids entry that references no real question', () => {
    const kit = validKit();
    kit.schedule.days[0]!.question_ids.push('q999');
    const result = Kit.safeParse(kit);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('q999'))).toBe(true);
  });

  it('rejects a difficulty outside 1-3', () => {
    const kit = validKit();
    kit.questions[0]!.difficulty = 4;
    expect(Kit.safeParse(kit).success).toBe(false);
  });

  it('accepts a schedule day with 0 minutes (genuinely nothing to study)', () => {
    const kit = validKit();
    kit.schedule.days[0]!.minutes = 0;
    expect(Kit.safeParse(kit).success).toBe(true);
  });

  it('rejects a schedule whose day count does not match days_available', () => {
    const kit = validKit();
    kit.schedule.days_available = 3;
    expect(Kit.safeParse(kit).success).toBe(false);
  });
});

describe('id minter', () => {
  it('mints stable, sequential, prefixed ids', () => {
    const nextId = createIdMinter('r');
    expect(nextId()).toBe('r1');
    expect(nextId()).toBe('r2');
    expect(nextId()).toBe('r3');
  });

  it('keeps independent counters per minter instance', () => {
    const nextR = createIdMinter('r');
    const nextQ = createIdMinter('q');
    expect(nextR()).toBe('r1');
    expect(nextQ()).toBe('q1');
    expect(nextR()).toBe('r2');
  });
});

describe('Batch contracts (Appendix B)', () => {
  it('accepts a valid batch input case', () => {
    const result = BatchInput.safeParse([
      { id: 'case-01', jd: 'Senior Backend Engineer...', company_url: 'http://localhost:8099/acme/', days: 5 },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects a batch case missing required fields', () => {
    const result = BatchCase.safeParse({ id: 'case-01', jd: 'x' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid ok result and a valid failed result', () => {
    const result = BatchOutput.safeParse({
      version: '1.0',
      generated_at: '2026-09-01T09:12:44Z',
      kits: [
        { id: 'case-01', status: 'ok', kit: validKit(), error: null },
        {
          id: 'case-04',
          status: 'failed',
          kit: null,
          error: { code: 'COMPANY_UNREACHABLE', message: 'Company site unreachable after 3 retries.' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a status "ok" result carrying a null kit', () => {
    const result = BatchOutput.safeParse({
      version: '1.0',
      generated_at: '2026-09-01T09:12:44Z',
      kits: [{ id: 'case-01', status: 'ok', kit: null, error: null }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a status "failed" result carrying a non-null kit', () => {
    const result = BatchOutput.safeParse({
      version: '1.0',
      generated_at: '2026-09-01T09:12:44Z',
      kits: [{ id: 'case-04', status: 'failed', kit: validKit(), error: null }],
    });
    expect(result.success).toBe(false);
  });
});
