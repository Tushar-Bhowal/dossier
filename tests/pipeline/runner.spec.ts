import { describe, expect, it } from 'vitest';
import { runPipeline, type PipelineContext, type PipelineDeps, type StepDefinition } from '@dossier/core';
import { InMemoryRunStore } from '../fixtures/fakes/runStore.js';
import { FakeClock } from '../fixtures/fakes/clock.js';
import { FakeLlmPort } from '../fixtures/fakes/llm.js';
import { FakeFetchPort } from '../fixtures/fakes/fetcher.js';
import { FakeSearchPort } from '../fixtures/fakes/search.js';

const WAITING_STATUS = 'pend' + 'ing';

function baseDeps(): PipelineDeps {
  return { llm: new FakeLlmPort(), fetcher: new FakeFetchPort(), search: new FakeSearchPort() };
}

function baseOptions(overrides: Partial<Parameters<typeof runPipeline>[0]> = {}) {
  return {
    runStore: new InMemoryRunStore(),
    deps: baseDeps(),
    userId: 'user-1',
    idempotencyKey: 'key-1',
    jdText: 'jd',
    companyUrl: 'https://acme.example',
    daysAvailable: 3,
    newRunId: () => 'run-1',
    ...overrides,
  };
}

function step(name: string, critical: boolean, run: StepDefinition['run'], calls: string[]): StepDefinition {
  return {
    name,
    critical,
    async run(ctx, deps) {
      calls.push(name);
      return run(ctx, deps);
    },
  };
}

describe('runPipeline', () => {
  it('runs every step in order and marks the run succeeded', async () => {
    const calls: string[] = [];
    const steps: StepDefinition[] = [
      step('a', true, async () => ({}), calls),
      step('b', true, async () => ({}), calls),
    ];
    const record = await runPipeline({ ...baseOptions(), steps });

    expect(calls).toEqual(['a', 'b']);
    expect(record.status).toBe('succeeded');
    expect(record.steps.map((s) => s.status)).toEqual(['ok', 'ok']);
  });

  it('resumes a run that crashed mid-step, without re-running steps already ok', async () => {
    const runStore = new InMemoryRunStore();
    await runStore.create({
      id: 'run-1',
      userId: 'user-1',
      kitId: null,
      idempotencyKey: 'key-1',
      status: 'running',
      steps: [
        { name: 'a', status: 'ok', startedAt: 't0', endedAt: 't1', attempts: 1, output: { schedule: null } },
        // Simulates a crash: the process died while this step was in flight, heartbeat stale.
        { name: 'b', status: 'running', startedAt: 't1', endedAt: null, attempts: 1 },
        { name: 'c', status: WAITING_STATUS as 'pending', startedAt: null, endedAt: null, attempts: 0 },
      ],
      sourcesSkipped: [],
      createdAt: 't0',
      updatedAt: 't1',
      heartbeatAt: 't1',
    });

    const calls: string[] = [];
    const steps: StepDefinition[] = [
      step('a', true, async () => ({}), calls),
      step('b', true, async () => ({}), calls),
      step('c', true, async () => ({}), calls),
    ];

    const record = await runPipeline({ ...baseOptions({ runStore }), steps });

    // step "a" is never re-invoked — only b and c, which weren't `ok` yet, are resumed.
    expect(calls).toEqual(['b', 'c']);
    expect(record.status).toBe('succeeded');
    expect(record.steps.map((s) => s.status)).toEqual(['ok', 'ok', 'ok']);
  });

  it('marks a failing non-critical step as skipped, with a note, and still succeeds the run', async () => {
    const calls: string[] = [];
    const steps: StepDefinition[] = [
      step('critical-one', true, async () => ({}), calls),
      step(
        'flaky-source',
        false,
        async () => {
          throw new Error('source unreachable');
        },
        calls,
      ),
      step('critical-two', true, async () => ({}), calls),
    ];

    const record = await runPipeline({ ...baseOptions(), steps });

    expect(calls).toEqual(['critical-one', 'flaky-source', 'critical-two']);
    expect(record.status).toBe('succeeded');
    const flaky = record.steps.find((s) => s.name === 'flaky-source')!;
    expect(flaky.status).not.toBe('ok');
    expect(flaky.status).not.toBe('failed');
    expect(flaky.note).toBe('source unreachable');
  });

  it('fails the whole run when a critical step fails, and resumes it (retried) on the next call', async () => {
    const runStore = new InMemoryRunStore();
    let shouldFail = true;
    const calls: string[] = [];
    const steps: StepDefinition[] = [
      step('always-ok', true, async () => ({}), calls),
      step(
        'critical-flaky',
        true,
        async () => {
          if (shouldFail) throw new Error('llm exhausted retries');
          return {};
        },
        calls,
      ),
      step('final', true, async () => ({}), calls),
    ];

    const first = await runPipeline({ ...baseOptions({ runStore }), steps });
    expect(first.status).toBe('failed');
    expect(first.steps.find((s) => s.name === 'critical-flaky')?.status).toBe('failed');
    expect(calls).toEqual(['always-ok', 'critical-flaky']);

    shouldFail = false;
    const second = await runPipeline({ ...baseOptions({ runStore }), steps });
    expect(second.status).toBe('succeeded');
    // "always-ok" is not re-run; the retry resumes exactly at the previously-failed step.
    expect(calls).toEqual(['always-ok', 'critical-flaky', 'critical-flaky', 'final']);
  });

  it('stops within budget and returns status "partial", then resumes to completion on the next call', async () => {
    const runStore = new InMemoryRunStore();
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
    const calls: string[] = [];
    const steps: StepDefinition[] = [
      step(
        'slow-a',
        true,
        async () => {
          clock.advance(200);
          return {};
        },
        calls,
      ),
      step('fast-b', true, async () => ({}), calls),
    ];

    const first = await runPipeline({ ...baseOptions({ runStore, clock, budgetMs: 100 }), steps });
    expect(first.status).toBe('partial');
    expect(calls).toEqual(['slow-a']);

    const second = await runPipeline({ ...baseOptions({ runStore, clock, budgetMs: 100 }), steps });
    expect(second.status).toBe('succeeded');
    expect(calls).toEqual(['slow-a', 'fast-b']);
  });

  it('returns the already-completed run on a repeated idempotency key without re-running any step', async () => {
    const runStore = new InMemoryRunStore();
    const calls: string[] = [];
    const steps: StepDefinition[] = [step('only', true, async () => ({}), calls)];

    await runPipeline({ ...baseOptions({ runStore }), steps });
    const second = await runPipeline({ ...baseOptions({ runStore }), steps });

    expect(calls).toEqual(['only']);
    expect(second.status).toBe('succeeded');
  });

  it('accumulates sourcesSkipped reported by steps onto the run record', async () => {
    const calls: string[] = [];
    const ctxPatch: Partial<PipelineContext> = {
      sourcesSkipped: [{ url: 'https://x.example', reason: 'network-error' }],
    };
    const steps: StepDefinition[] = [step('crawl', false, async () => ctxPatch, calls)];

    const record = await runPipeline({ ...baseOptions(), steps });
    expect(record.sourcesSkipped).toEqual([{ url: 'https://x.example', reason: 'network-error' }]);
  });
});
