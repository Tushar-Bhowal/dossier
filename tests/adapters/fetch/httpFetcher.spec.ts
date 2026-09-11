import { describe, expect, it, vi } from 'vitest';
import { FetchPortError, HttpFetcher } from '@dossier/core';

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function notFound(): Response {
  return new Response('not found', { status: 404 });
}

function makeFetchImpl(routes: Record<string, () => Response>) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    const handler = routes[url];
    if (handler) return handler();
    if (url.endsWith('/robots.txt')) return notFound();
    return notFound();
  }) as unknown as typeof fetch;
}

describe('HttpFetcher', () => {
  it('fetches a public IP target and returns the body text', async () => {
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/': () => htmlResponse('<p>hello</p>'),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0 });
    const result = await fetcher.fetch('http://93.184.216.34/');
    expect(result.status).toBe(200);
    expect(result.text).toContain('hello');
    expect(result.contentType).toBe('text/html');
  });

  it('blocks a redirect that points at a private IP address instead of following it', async () => {
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/': () =>
        new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/internal' } }),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0 });
    await expect(fetcher.fetch('http://93.184.216.34/')).rejects.toMatchObject({ reason: 'blocked-host' });
    // the private redirect target must never actually be requested
    expect(fetchImpl).not.toHaveBeenCalledWith('http://10.0.0.1/internal', expect.anything());
  });

  it('follows a redirect to another public address and returns the final body', async () => {
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/': () =>
        new Response(null, { status: 301, headers: { location: 'http://151.101.1.69/moved' } }),
      'http://151.101.1.69/moved': () => htmlResponse('<p>moved content</p>'),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0 });
    const result = await fetcher.fetch('http://93.184.216.34/');
    expect(result.finalUrl).toBe('http://151.101.1.69/moved');
    expect(result.text).toContain('moved content');
  });

  it('gives up after too many redirects', async () => {
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/': () =>
        new Response(null, { status: 302, headers: { location: 'http://93.184.216.35/' } }),
      'http://93.184.216.35/': () =>
        new Response(null, { status: 302, headers: { location: 'http://93.184.216.36/' } }),
      'http://93.184.216.36/': () =>
        new Response(null, { status: 302, headers: { location: 'http://93.184.216.37/' } }),
      'http://93.184.216.37/': () =>
        new Response(null, { status: 302, headers: { location: 'http://93.184.216.38/' } }),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0, maxRedirects: 3 });
    await expect(fetcher.fetch('http://93.184.216.34/')).rejects.toMatchObject({ reason: 'http-error' });
  });

  it('rejects a response with a disallowed content-type', async () => {
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/': () =>
        new Response('%PDF-1.4', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0 });
    await expect(fetcher.fetch('http://93.184.216.34/')).rejects.toMatchObject({
      reason: 'unsupported-content-type',
    });
  });

  it('aborts mid-stream once the response body exceeds the size cap', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('a'.repeat(20)));
        controller.enqueue(encoder.encode('b'.repeat(20)));
        controller.close();
      },
    });
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/': () =>
        new Response(stream, { status: 200, headers: { 'content-type': 'text/plain' } }),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0, maxBytes: 25 });
    await expect(fetcher.fetch('http://93.184.216.34/')).rejects.toMatchObject({ reason: 'too-large' });
  });

  it('honours robots.txt Disallow for the wildcard user-agent', async () => {
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/robots.txt': () => new Response('User-agent: *\nDisallow: /private\n', { status: 200 }),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0 });
    await expect(fetcher.fetch('http://93.184.216.34/private/page')).rejects.toMatchObject({
      reason: 'robots-disallowed',
    });
    expect(fetchImpl).not.toHaveBeenCalledWith('http://93.184.216.34/private/page', expect.anything());
  });

  it('allows a path robots.txt does not disallow', async () => {
    const fetchImpl = makeFetchImpl({
      'http://93.184.216.34/robots.txt': () => new Response('User-agent: *\nDisallow: /private\n', { status: 200 }),
      'http://93.184.216.34/public': () => htmlResponse('<p>public page</p>'),
    });
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0 });
    const result = await fetcher.fetch('http://93.184.216.34/public');
    expect(result.text).toContain('public page');
  });

  it('rejects a URL routed through a disallowed scheme before ever calling fetch', async () => {
    const fetchImpl = makeFetchImpl({});
    const fetcher = new HttpFetcher({ fetchImpl, perHostIntervalMs: 0 });
    await expect(fetcher.fetch('ftp://93.184.216.34/')).rejects.toBeInstanceOf(FetchPortError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
