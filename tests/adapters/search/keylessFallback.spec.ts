import { describe, expect, it, vi } from 'vitest';
import { KeylessSearchAdapter } from '@dossier/core';

function ddgHtml(): string {
  return `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Facme.example%2Fblog">Acme engineering blog</a>`;
}

function redditJson(): string {
  return JSON.stringify({
    data: { children: [{ data: { title: 'Acme interview experience', permalink: '/r/x/1', selftext: 'it went fine' } }] },
  });
}

describe('KeylessSearchAdapter', () => {
  it('combines DuckDuckGo and Reddit results when both succeed', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('duckduckgo.com')) return new Response(ddgHtml(), { status: 200 });
      if (url.includes('reddit.com')) return new Response(redditJson(), { status: 200 });
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    const adapter = new KeylessSearchAdapter({ fetchImpl });
    const results = await adapter.search('acme interview process');

    expect(results).toContainEqual({ title: 'Acme engineering blog', url: 'https://acme.example/blog', snippet: '' });
    expect(results.some((r) => r.title === 'Acme interview experience')).toBe(true);
  });

  it('returns whatever succeeded when only one source is reachable', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('duckduckgo.com')) throw new Error('network down');
      return new Response(redditJson(), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new KeylessSearchAdapter({ fetchImpl });
    const results = await adapter.search('acme interview process');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Acme interview experience');
  });

  it('throws when both DuckDuckGo and Reddit are unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const adapter = new KeylessSearchAdapter({ fetchImpl });
    await expect(adapter.search('acme interview process')).rejects.toThrow();
  });
});
