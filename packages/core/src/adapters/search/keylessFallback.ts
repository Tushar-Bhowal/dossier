import type { SearchPort, SearchResult } from '../../ports/search.js';

const USER_AGENT = 'DossierBot/1.0 (+https://github.com/Tushar-Bhowal/dossier; interview-prep research)';

// DuckDuckGo's no-JS HTML endpoint wraps result links as /l/?uddg=<encoded target> — unwrap it to
// get the real destination.
function decodeDuckDuckGoRedirect(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : url.href;
  } catch {
    return href;
  }
}

export interface KeylessSearchAdapterOptions {
  fetchImpl?: typeof fetch;
  maxResults?: number;
}

// The no-API-key fallback: DuckDuckGo's HTML search plus Reddit's public .json search, both
// scraped with plain regex/JSON parsing rather than a scraping dependency. Either source failing
// doesn't fail the search — only both failing does, so the caller can record a real gap.
export class KeylessSearchAdapter implements SearchPort {
  private readonly fetchImpl: typeof fetch;
  private readonly maxResults: number;

  constructor(options: KeylessSearchAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxResults = options.maxResults ?? 5;
  }

  async search(query: string): Promise<SearchResult[]> {
    const [duckDuckGo, reddit] = await Promise.allSettled([
      this.searchDuckDuckGo(query),
      this.searchReddit(query),
    ]);
    const results: SearchResult[] = [];
    if (duckDuckGo.status === 'fulfilled') results.push(...duckDuckGo.value);
    if (reddit.status === 'fulfilled') results.push(...reddit.value);
    if (results.length === 0) {
      throw new Error(`keyless search failed for "${query}": both DuckDuckGo and Reddit were unreachable`);
    }
    return results.slice(0, this.maxResults);
  }

  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await this.fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}`);
    const html = await response.text();
    const results: SearchResult[] = [];
    const pattern = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null && results.length < this.maxResults) {
      const title = match[2]!.replace(/<[^>]+>/g, '').trim();
      results.push({ title, url: decodeDuckDuckGoRedirect(match[1]!), snippet: '' });
    }
    return results;
  }

  private async searchReddit(query: string): Promise<SearchResult[]> {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${this.maxResults}`;
    const response = await this.fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Reddit returned ${response.status}`);
    const payload = (await response.json()) as {
      data?: { children?: { data?: { title?: string; permalink?: string; selftext?: string } }[] };
    };
    const children = payload.data?.children ?? [];
    return children.map((child) => ({
      title: child.data?.title ?? '',
      url: child.data?.permalink ? `https://www.reddit.com${child.data.permalink}` : '',
      snippet: (child.data?.selftext ?? '').slice(0, 300),
    }));
  }
}
