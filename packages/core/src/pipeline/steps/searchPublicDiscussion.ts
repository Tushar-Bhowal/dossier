import type { SearchPort, SearchResult } from '../../ports/search.js';
import type { SourceSkipped } from '../../ports/runStore.js';

export interface SearchChainOptions {
  tavily?: SearchPort | null;
  keyless: SearchPort;
}

// A missing TAVILY_API_KEY (tavily: null) falls through to the keyless adapter silently — Tavily
// is a nice-to-have, not a requirement (§9) — and a configured Tavily key that errors at call time
// falls back the same way, so a Tavily outage doesn't cost the run its only search source.
export function createSearchChain({ tavily, keyless }: SearchChainOptions): SearchPort {
  if (!tavily) return keyless;
  return {
    async search(query: string): Promise<SearchResult[]> {
      try {
        return await tavily.search(query);
      } catch {
        return keyless.search(query);
      }
    },
  };
}

export interface SearchPublicDiscussionResult {
  results: SearchResult[];
  sourcesSkipped: SourceSkipped[];
}

// A missing source is not a failed kit (§2): if every configured search path fails, the gap is
// recorded and the pipeline continues rather than throwing.
export async function searchPublicDiscussion(
  searchPort: SearchPort,
  query: string,
): Promise<SearchPublicDiscussionResult> {
  try {
    const results = await searchPort.search(query);
    return { results, sourcesSkipped: [] };
  } catch (err) {
    return {
      results: [],
      sourcesSkipped: [
        { url: `search:${query}`, reason: err instanceof Error ? err.message : 'unknown-error' },
      ],
    };
  }
}
