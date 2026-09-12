import { describe, expect, it } from 'vitest';
import { FetchPortError, crawlCompany } from '@dossier/core';
import { FakeFetchPort } from '../../fixtures/fakes/fetcher.js';

function page(url: string, html: string) {
  return { url, finalUrl: url, status: 200, contentType: 'text/html', text: html };
}

describe('crawlCompany', () => {
  it('collects same-origin links from the homepage and the sitemap', async () => {
    const fetcher = new FakeFetchPort();
    fetcher.set(
      'https://acme.example/',
      page(
        'https://acme.example/',
        '<a href="/about">About</a><a href="https://other.example/blog">External</a>',
      ),
    );
    fetcher.set(
      'https://acme.example/sitemap.xml',
      page(
        'https://acme.example/sitemap.xml',
        '<urlset><url><loc>https://acme.example/careers</loc></url><url><loc>https://other.example/x</loc></url></urlset>',
      ),
    );

    const result = await crawlCompany(fetcher, 'https://acme.example/');

    expect(result.homepage?.url).toBe('https://acme.example/');
    const urls = result.links.map((l) => l.url);
    expect(urls).toContain('https://acme.example/about');
    expect(urls).toContain('https://acme.example/careers');
    expect(urls).not.toContain('https://other.example/blog');
    expect(urls).not.toContain('https://other.example/x');
    expect(result.sourcesSkipped).toEqual([]);
  });

  it('records a skipped source and continues when the homepage is unreachable', async () => {
    const fetcher = new FakeFetchPort();
    fetcher.set('https://acme.example/', new FetchPortError('down', 'network-error'));
    fetcher.set('https://acme.example/sitemap.xml', new FetchPortError('missing', 'http-error'));

    const result = await crawlCompany(fetcher, 'https://acme.example/');

    expect(result.homepage).toBeNull();
    expect(result.links).toEqual([]);
    expect(result.sourcesSkipped).toEqual([
      { url: 'https://acme.example/', reason: 'network-error' },
      { url: 'https://acme.example/sitemap.xml', reason: 'http-error' },
    ]);
  });

  it('crawls the given path, not just the host origin', async () => {
    const fetcher = new FakeFetchPort();
    fetcher.set(
      'https://acme.example/careers-site/',
      page('https://acme.example/careers-site/', '<a href="/careers-site/jobs">Jobs</a>'),
    );
    fetcher.set(
      'https://acme.example/careers-site/sitemap.xml',
      page('https://acme.example/careers-site/sitemap.xml', '<urlset><url><loc>https://acme.example/careers-site/culture</loc></url></urlset>'),
    );

    const result = await crawlCompany(fetcher, 'https://acme.example/careers-site/');

    expect(result.homepage?.url).toBe('https://acme.example/careers-site/');
    const urls = result.links.map((l) => l.url);
    expect(urls).toContain('https://acme.example/careers-site/jobs');
    expect(urls).toContain('https://acme.example/careers-site/culture');
  });

  it('reports an invalid company URL without throwing', async () => {
    const fetcher = new FakeFetchPort();
    const result = await crawlCompany(fetcher, 'not a url');
    expect(result.homepage).toBeNull();
    expect(result.sourcesSkipped).toEqual([{ url: 'not a url', reason: 'invalid-url' }]);
  });
});
