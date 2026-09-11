import type { SearchPort, SearchResult } from '../../ports/search.js';

export interface TavilySearchAdapterOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  maxResults?: number;
}

export class TavilySearchAdapter implements SearchPort {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly maxResults: number;

  constructor(options: TavilySearchAdapterOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.tavily.com';
    this.maxResults = options.maxResults ?? 5;
  }

  async search(query: string): Promise<SearchResult[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey, query, max_results: this.maxResults }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`Tavily search failed with status ${response.status}`);
    }
    const payload = (await response.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    return (payload.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    }));
  }
}
