import { describe, expect, it, vi } from 'vitest';
import { TavilySearchAdapter } from '@dossier/core';

describe('TavilySearchAdapter', () => {
  it('maps Tavily results to SearchResult', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ title: 'Acme interview process', url: 'https://x.example', content: 'notes' }] }),
        { status: 200 },
      ),
    );
    const adapter = new TavilySearchAdapter({ apiKey: 'key', fetchImpl });
    const results = await adapter.search('acme interview process');
    expect(results).toEqual([{ title: 'Acme interview process', url: 'https://x.example', snippet: 'notes' }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when Tavily responds with a non-ok status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    const adapter = new TavilySearchAdapter({ apiKey: 'bad-key', fetchImpl });
    await expect(adapter.search('query')).rejects.toThrow('401');
  });
});
