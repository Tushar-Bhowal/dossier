export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
}

// Every rejection reason a fetch can fail for — steps use this to write a human-readable
// sourcesSkipped entry without needing to inspect error internals.
export type FetchFailureReason =
  | 'blocked-host'
  | 'disallowed-scheme'
  | 'robots-disallowed'
  | 'unsupported-content-type'
  | 'too-large'
  | 'timeout'
  | 'http-error'
  | 'network-error';

export class FetchPortError extends Error {
  constructor(
    message: string,
    public readonly reason: FetchFailureReason,
  ) {
    super(message);
    this.name = 'FetchPortError';
  }
}

export interface FetchPort {
  fetch(url: string): Promise<FetchResult>;
}
