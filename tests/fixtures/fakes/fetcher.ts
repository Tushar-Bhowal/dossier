import { FetchPortError, type FetchPort, type FetchResult } from '@dossier/core';

export class FakeFetchPort implements FetchPort {
  private routes = new Map<string, FetchResult | FetchPortError>();

  set(url: string, result: FetchResult | FetchPortError): void {
    this.routes.set(url, result);
  }

  async fetch(url: string): Promise<FetchResult> {
    const route = this.routes.get(url);
    if (!route) {
      throw new FetchPortError(`FakeFetchPort: no route registered for ${url}`, 'network-error');
    }
    if (route instanceof FetchPortError) throw route;
    return route;
  }
}
