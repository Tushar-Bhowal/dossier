import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FetchPortError, LlmCallError } from '@dossier/core';
import { FakeClock } from '../fixtures/fakes/clock.js';
import { FakeLlmPort } from '../fixtures/fakes/llm.js';
import { FakeFetchPort } from '../fixtures/fakes/fetcher.js';
import { FakeSearchPort } from '../fixtures/fakes/search.js';
import { InMemoryRunStore } from '../fixtures/fakes/runStore.js';

describe('FakeClock', () => {
  it('returns the fixed time until advanced', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:01:00.000Z');
  });
});

describe('FakeLlmPort', () => {
  it('validates and returns queued responses in order, tracking calls', async () => {
    const llm = new FakeLlmPort();
    const schema = z.object({ text: z.string() });
    llm.enqueue({ text: 'first' });
    llm.enqueue({ text: 'second' });

    const first = await llm.generate({ model: 'flash-lite', system: 's', prompt: 'p1', schema });
    const second = await llm.generate({ model: 'flash', system: 's', prompt: 'p2', schema });

    expect(first).toEqual({ text: 'first' });
    expect(second).toEqual({ text: 'second' });
    expect(llm.calls.map((c) => c.prompt)).toEqual(['p1', 'p2']);
  });

  it('throws LlmCallError when the queue is empty', async () => {
    const llm = new FakeLlmPort();
    await expect(
      llm.generate({ model: 'flash', system: 's', prompt: 'p', schema: z.object({}) }),
    ).rejects.toThrow(LlmCallError);
  });

  it('rejects a queued response that does not match the schema', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ wrong: true });
    await expect(
      llm.generate({ model: 'flash', system: 's', prompt: 'p', schema: z.object({ text: z.string() }) }),
    ).rejects.toThrow();
  });
});

describe('FakeFetchPort', () => {
  it('returns a registered route', async () => {
    const fetcher = new FakeFetchPort();
    fetcher.set('https://example.com/', {
      url: 'https://example.com/',
      finalUrl: 'https://example.com/',
      status: 200,
      contentType: 'text/html',
      text: '<html></html>',
    });
    const result = await fetcher.fetch('https://example.com/');
    expect(result.status).toBe(200);
  });

  it('throws the registered FetchPortError for a blocked route', async () => {
    const fetcher = new FakeFetchPort();
    fetcher.set('https://internal/', new FetchPortError('blocked', 'blocked-host'));
    await expect(fetcher.fetch('https://internal/')).rejects.toMatchObject({ reason: 'blocked-host' });
  });

  it('throws for an unregistered URL rather than silently succeeding', async () => {
    const fetcher = new FakeFetchPort();
    await expect(fetcher.fetch('https://unknown.example/')).rejects.toThrow(FetchPortError);
  });
});

describe('FakeSearchPort', () => {
  it('returns registered results for a query and an empty array otherwise', async () => {
    const search = new FakeSearchPort();
    search.set('acme interview process', [{ title: 'Acme blog', url: 'https://acme.example/blog', snippet: '...' }]);
    expect(await search.search('acme interview process')).toHaveLength(1);
    expect(await search.search('nothing registered')).toEqual([]);
  });
});

describe('InMemoryRunStore', () => {
  const baseRecord = {
    id: 'run_1',
    userId: 'user_1',
    kitId: null,
    idempotencyKey: 'key_1',
    status: 'queued' as const,
    steps: [],
    sourcesSkipped: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    heartbeatAt: '2026-01-01T00:00:00.000Z',
  };

  it('creates and retrieves a run by id', async () => {
    const store = new InMemoryRunStore();
    await store.create(baseRecord);
    const found = await store.get('run_1');
    expect(found?.status).toBe('queued');
  });

  it('finds a run by idempotency key scoped to a user', async () => {
    const store = new InMemoryRunStore();
    await store.create(baseRecord);
    expect(await store.findByIdempotencyKey('user_1', 'key_1')).not.toBeNull();
    expect(await store.findByIdempotencyKey('other_user', 'key_1')).toBeNull();
  });

  it('rejects a second run with the same user + idempotency key, like the unique index would', async () => {
    const store = new InMemoryRunStore();
    await store.create(baseRecord);
    await expect(store.create({ ...baseRecord, id: 'run_2' })).rejects.toThrow();
  });

  it('updates fields without touching the id, and rejects an unknown id', async () => {
    const store = new InMemoryRunStore();
    await store.create(baseRecord);
    await store.update('run_1', { status: 'running' });
    expect((await store.get('run_1'))?.status).toBe('running');
    await expect(store.update('missing', { status: 'failed' })).rejects.toThrow();
  });
});
