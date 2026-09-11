import { describe, expect, it } from 'vitest';
import { InMemoryRunStore, createSearchChain, type PipelineDeps } from '@dossier/core';
import { parseArgs, processCase, runBatch } from '../src/main.js';
import { FakeLlmPort } from '../../../tests/fixtures/fakes/llm.js';
import { FakeFetchPort } from '../../../tests/fixtures/fakes/fetcher.js';
import { FakeSearchPort } from '../../../tests/fixtures/fakes/search.js';

function makeDeps(llm: FakeLlmPort, fetcher: FakeFetchPort): PipelineDeps {
  return { llm, fetcher, search: createSearchChain({ tavily: null, keyless: new FakeSearchPort() }) };
}

// The homepage/sitemap fetch fails and search returns nothing, so discoverHiringPages and
// generateCompanyBrief both skip their own LLM calls (no content to re-rank / summarize) — the
// real call sequence for this fixture is: extract → technical questions → company-fit questions →
// flashcards. fillCoverageGaps needs no call here since the technical question already covers r1.
function queueHappyPathResponses(llm: FakeLlmPort): void {
  llm.enqueue({ requirements: [{ text: 'Python', kind: 'technical', priority: 'must', quote: 'Python (required)' }] }); // extractRequirements
  llm.enqueue({ questions: [{ prompt: 'Explain Python GIL', answer_outline: '', difficulty: 2, requirement_ids: ['r1'] }] }); // technical questions
  llm.enqueue({ questions: [{ prompt: 'Why us?', answer_outline: '', difficulty: 1, requirement_ids: [] }] }); // company-fit questions
  llm.enqueue({ flashcards: [{ front: 'Python?', back: 'A language', requirement_ids: ['r1'] }] }); // flashcards
}

describe('parseArgs', () => {
  it('parses --input and --output flags', () => {
    expect(parseArgs(['--input', 'a.json', '--output', 'b.json'])).toEqual({
      input: 'a.json',
      output: 'b.json',
      allowPrivateHosts: false,
    });
  });

  it('throws a clear error when a required flag is missing', () => {
    expect(() => parseArgs(['--input', 'a.json'])).toThrow(/usage: evaluate/);
  });
});

describe('processCase', () => {
  it('produces an "ok" result with a schema-valid kit for a successful run', async () => {
    const llm = new FakeLlmPort();
    const fetcher = new FakeFetchPort();
    fetcher.set('http://127.0.0.1:9999/', new (await import('@dossier/core')).FetchPortError('down', 'network-error'));
    fetcher.set(
      'http://127.0.0.1:9999/sitemap.xml',
      new (await import('@dossier/core')).FetchPortError('down', 'network-error'),
    );
    queueHappyPathResponses(llm);

    const result = await processCase(
      { id: 'case-1', jd: 'Backend role. Python (required).', company_url: 'http://127.0.0.1:9999/', days: 3 },
      makeDeps(llm, fetcher),
      new InMemoryRunStore(),
    );

    expect(result.status).toBe('ok');
    expect(result.error).toBeNull();
    expect(result.kit?.role.requirements).toHaveLength(1);
    expect(result.kit?.questions.length).toBeGreaterThan(0);
  });

  it('returns a "failed" result with a code, never throwing, when a critical step fails', async () => {
    const llm = new FakeLlmPort(); // no responses queued — the first (critical) LLM call throws
    const fetcher = new FakeFetchPort();

    const result = await processCase(
      { id: 'case-2', jd: 'Backend role.', company_url: 'http://127.0.0.1:9999/', days: 3 },
      makeDeps(llm, fetcher),
      new InMemoryRunStore(),
    );

    expect(result.status).toBe('failed');
    expect(result.kit).toBeNull();
    expect(result.error?.code).toBeTruthy();
  });
});

describe('runBatch', () => {
  it('returns exactly one result per input case, in the same order, even when every case fails', async () => {
    const llm = new FakeLlmPort(); // no responses queued — every case's first LLM call throws
    const fetcher = new FakeFetchPort();

    const results = await runBatch(
      [
        { id: 'case-a', jd: 'Backend role.', company_url: 'http://127.0.0.1:9999/', days: 2 },
        { id: 'case-b', jd: 'Backend role.', company_url: 'http://127.0.0.1:9999/', days: 2 },
        { id: 'case-c', jd: 'Backend role.', company_url: 'http://127.0.0.1:9999/', days: 2 },
      ],
      makeDeps(llm, fetcher),
      new InMemoryRunStore(),
    );

    expect(results.map((r) => r.id)).toEqual(['case-a', 'case-b', 'case-c']);
    expect(results.every((r) => r.status === 'failed' && !!r.error?.code)).toBe(true);
  });

  it('completes a case that can succeed independently of a case that fails', async () => {
    const fetcher = new FakeFetchPort();

    const successLlm = new FakeLlmPort();
    queueHappyPathResponses(successLlm);
    const successOnly = await runBatch(
      [{ id: 'ok-case', jd: 'Backend role. Python (required).', company_url: 'http://127.0.0.1:9999/', days: 2 }],
      makeDeps(successLlm, fetcher),
      new InMemoryRunStore(),
    );
    expect(successOnly[0]?.status).toBe('ok');

    const failLlm = new FakeLlmPort();
    const failOnly = await runBatch(
      [{ id: 'fail-case', jd: 'Backend role.', company_url: 'http://127.0.0.1:9999/', days: 2 }],
      makeDeps(failLlm, fetcher),
      new InMemoryRunStore(),
    );
    expect(failOnly[0]?.status).toBe('failed');
  });
});
