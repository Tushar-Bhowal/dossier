import type { Clock } from '../../ports/clock.js';
import { FetchPortError, type FetchPort, type FetchResult } from '../../ports/fetcher.js';
import { assertUrlAllowed } from './urlPolicy.js';

// text/xml belongs here alongside application/xml: it is what most servers actually serve
// sitemap.xml as, and omitting it silently cost us the sitemap — often the highest-yield source.
const ALLOWED_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'text/xml',
  'application/xhtml+xml',
  'application/xml',
];
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_PER_HOST_INTERVAL_MS = 1000;
const DEFAULT_USER_AGENT = 'DossierBot/1.0 (+https://github.com/Tushar-Bhowal/dossier; interview-prep research)';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Spaces out requests to the same host (1 req/s by default) so the crawler's concurrency-2 fan-out
// (Task 12) can't hammer one site — chained through a promise queue, same pattern as RateLimiter.
class PerHostLimiter {
  private lastRequestAt = new Map<string, number>();
  private queues = new Map<string, Promise<void>>();

  constructor(
    private readonly intervalMs: number,
    private readonly clock: Clock,
  ) {}

  async wait(host: string): Promise<void> {
    const previous = this.queues.get(host) ?? Promise.resolve();
    const next = previous.then(() => this.reserve(host));
    this.queues.set(
      host,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }

  private async reserve(host: string): Promise<void> {
    const now = this.clock.now().getTime();
    const last = this.lastRequestAt.get(host) ?? -Infinity;
    const wait = Math.max(0, last + this.intervalMs - now);
    if (wait > 0) await sleep(wait);
    this.lastRequestAt.set(host, this.clock.now().getTime());
  }
}

interface RobotsRules {
  disallow: string[];
}

// Only the `User-agent: *` group is honoured — sufficient for a research bot that doesn't need
// per-crawler-name treatment, and far simpler than full robots.txt spec compliance.
function parseRobotsTxt(body: string): RobotsRules {
  const disallow: string[] = [];
  let inWildcardGroup = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]!.trim();
    if (!line) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (key === 'user-agent') {
      inWildcardGroup = value === '*';
    } else if (key === 'disallow' && inWildcardGroup && value !== '') {
      disallow.push(value);
    }
  }
  return { disallow };
}

// Cached per HttpFetcher instance, which is created once per run — matches "cached per run".
class RobotsCache {
  private cache = new Map<string, Promise<RobotsRules>>();

  constructor(private readonly fetchRobotsTxt: (origin: string) => Promise<string | null>) {}

  async isAllowed(url: URL): Promise<boolean> {
    let pending = this.cache.get(url.origin);
    if (!pending) {
      pending = this.load(url.origin);
      this.cache.set(url.origin, pending);
    }
    const rules = await pending;
    const path = url.pathname || '/';
    return !rules.disallow.some((rule) => path.startsWith(rule));
  }

  private async load(origin: string): Promise<RobotsRules> {
    const body = await this.fetchRobotsTxt(origin).catch(() => null);
    return body ? parseRobotsTxt(body) : { disallow: [] };
  }
}

export interface HttpFetcherOptions {
  allowPrivateHosts?: boolean;
  userAgent?: string;
  maxRedirects?: number;
  maxBytes?: number;
  timeoutMs?: number;
  perHostIntervalMs?: number;
  fetchImpl?: typeof fetch;
  clock?: Clock;
}

export class HttpFetcher implements FetchPort {
  private readonly allowPrivateHosts: boolean;
  private readonly userAgent: string;
  private readonly maxRedirects: number;
  private readonly maxBytes: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly perHostLimiter: PerHostLimiter;
  private readonly robots: RobotsCache;

  constructor(options: HttpFetcherOptions = {}) {
    this.allowPrivateHosts = options.allowPrivateHosts ?? process.env.ALLOW_PRIVATE_HOSTS === 'true';
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.perHostLimiter = new PerHostLimiter(
      options.perHostIntervalMs ?? DEFAULT_PER_HOST_INTERVAL_MS,
      options.clock ?? { now: () => new Date() },
    );
    this.robots = new RobotsCache((origin) => this.fetchRobotsTxt(origin));
  }

  async fetch(rawUrl: string): Promise<FetchResult> {
    let currentUrl = await assertUrlAllowed(rawUrl, { allowPrivateHosts: this.allowPrivateHosts });

    for (let hop = 0; ; hop += 1) {
      await this.perHostLimiter.wait(currentUrl.host);

      const allowed = await this.robots.isAllowed(currentUrl);
      if (!allowed) {
        throw new FetchPortError(`robots.txt disallows ${currentUrl.pathname}`, 'robots-disallowed');
      }

      const response = await this.rawFetch(currentUrl);

      if (REDIRECT_STATUSES.has(response.status)) {
        if (hop >= this.maxRedirects) {
          throw new FetchPortError(`too many redirects starting from ${rawUrl}`, 'http-error');
        }
        const location = response.headers.get('location');
        if (!location) {
          throw new FetchPortError(`redirect from ${currentUrl.href} had no Location header`, 'http-error');
        }
        const nextUrl = new URL(location, currentUrl);
        // Re-validated on every hop (§11), so a redirect chain can't smuggle a private-IP target
        // in past the first check — DNS rebinding gets no second bite.
        currentUrl = await assertUrlAllowed(nextUrl.href, { allowPrivateHosts: this.allowPrivateHosts });
        continue;
      }

      if (!response.ok) {
        throw new FetchPortError(`${currentUrl.href} responded ${response.status}`, 'http-error');
      }

      const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        throw new FetchPortError(`unsupported content-type "${contentType}" for ${currentUrl.href}`, 'unsupported-content-type');
      }

      const text = await this.readCapped(response, currentUrl.href);
      return { url: rawUrl, finalUrl: currentUrl.href, status: response.status, contentType, text };
    }
  }

  private async rawFetch(url: URL): Promise<Response> {
    try {
      return await this.fetchImpl(url.href, {
        redirect: 'manual',
        headers: { 'user-agent': this.userAgent },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      throw new FetchPortError(
        `fetch failed for ${url.href}: ${(err as Error).message}`,
        isTimeout ? 'timeout' : 'network-error',
      );
    }
  }

  private async readCapped(response: Response, url: string): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new FetchPortError(`response body for ${url} exceeded ${this.maxBytes} bytes`, 'too-large');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
  }

  private async fetchRobotsTxt(origin: string): Promise<string | null> {
    try {
      const response = await this.fetchImpl(`${origin}/robots.txt`, {
        redirect: 'manual',
        headers: { 'user-agent': this.userAgent },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return null;
      // Streamed and capped the same as any other body — an unbounded robots.txt (hostile or just
      // broken) must not be able to buffer arbitrarily into memory.
      return await this.readCapped(response, `${origin}/robots.txt`);
    } catch {
      return null;
    }
  }
}
