export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchPort {
  search(query: string): Promise<SearchResult[]>;
}
