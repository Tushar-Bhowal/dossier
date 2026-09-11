import type { SearchPort, SearchResult } from '@dossier/core';

export class FakeSearchPort implements SearchPort {
  private routes = new Map<string, SearchResult[]>();

  set(query: string, results: SearchResult[]): void {
    this.routes.set(query, results);
  }

  async search(query: string): Promise<SearchResult[]> {
    return this.routes.get(query) ?? [];
  }
}
