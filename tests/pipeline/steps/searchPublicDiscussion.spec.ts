import { describe, expect, it } from 'vitest';
import { createSearchChain, searchPublicDiscussion } from '@dossier/core';
import { FakeSearchPort } from '../../fixtures/fakes/search.js';

describe('createSearchChain', () => {
  it('falls through to the keyless adapter silently when Tavily is not configured', async () => {
    const keyless = new FakeSearchPort();
    keyless.set('acme', [{ title: 'from keyless', url: 'https://x.example', snippet: '' }]);

    const chain = createSearchChain({ tavily: null, keyless });
    const results = await chain.search('acme');

    expect(results).toEqual([{ title: 'from keyless', url: 'https://x.example', snippet: '' }]);
  });

  it('falls back to keyless when a configured Tavily adapter throws', async () => {
    const tavily = { search: async () => { throw new Error('tavily down'); } };
    const keyless = new FakeSearchPort();
    keyless.set('acme', [{ title: 'from keyless', url: 'https://x.example', snippet: '' }]);

    const chain = createSearchChain({ tavily, keyless });
    const results = await chain.search('acme');

    expect(results).toEqual([{ title: 'from keyless', url: 'https://x.example', snippet: '' }]);
  });

  it('uses Tavily when it succeeds', async () => {
    const tavily = { search: async () => [{ title: 'from tavily', url: 'https://y.example', snippet: '' }] };
    const keyless = new FakeSearchPort();

    const chain = createSearchChain({ tavily, keyless });
    const results = await chain.search('acme');

    expect(results).toEqual([{ title: 'from tavily', url: 'https://y.example', snippet: '' }]);
  });
});

describe('searchPublicDiscussion', () => {
  it('returns results on success with no skipped sources', async () => {
    const search = new FakeSearchPort();
    search.set('acme', [{ title: 'a', url: 'https://x.example', snippet: '' }]);
    const result = await searchPublicDiscussion(search, 'acme');
    expect(result.results).toHaveLength(1);
    expect(result.sourcesSkipped).toEqual([]);
  });

  it('records a gap instead of throwing when the search chain fails entirely', async () => {
    const search = { search: async () => { throw new Error('everything is down'); } };
    const result = await searchPublicDiscussion(search, 'acme interview process');
    expect(result.results).toEqual([]);
    expect(result.sourcesSkipped).toEqual([
      { url: 'search:acme interview process', reason: 'everything is down' },
    ]);
  });
});
