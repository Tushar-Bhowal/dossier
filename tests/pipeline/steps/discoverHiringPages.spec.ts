import { describe, expect, it } from 'vitest';
import { crawlCompany, discoverHiringPages } from '@dossier/core';
import { FakeFetchPort } from '../../fixtures/fakes/fetcher.js';
import { FakeLlmPort } from '../../fixtures/fakes/llm.js';

function page(url: string, html: string) {
  return { url, finalUrl: url, status: 200, contentType: 'text/html', text: html };
}

describe('discoverHiringPages', () => {
  it('finds a hiring page at a non-obvious path, one hop below a moderately-relevant page', async () => {
    const fetcher = new FakeFetchPort();
    fetcher.set(
      'https://acme.example/',
      page(
        'https://acme.example/',
        '<a href="/about">About us</a><a href="/blog/2024/01/we-raised-a-round">Blog</a>',
      ),
    );
    fetcher.set(
      'https://acme.example/sitemap.xml',
      page('https://acme.example/sitemap.xml', '<urlset></urlset>'),
    );
    fetcher.set(
      'https://acme.example/about',
      page(
        'https://acme.example/about',
        '<p>We are a small team.</p><a href="/handbook/hiring/interviewing">Our interview process</a>',
      ),
    );
    fetcher.set(
      'https://acme.example/blog/2024/01/we-raised-a-round',
      page('https://acme.example/blog/2024/01/we-raised-a-round', '<p>We raised a round.</p>'),
    );
    fetcher.set(
      'https://acme.example/handbook/hiring/interviewing',
      page('https://acme.example/handbook/hiring/interviewing', '<p>Here is exactly how we interview.</p>'),
    );

    const llm = new FakeLlmPort();
    llm.enqueue({ rankedIndices: [0] }); // the model picks the "About" page as the closest candidate

    const crawlResult = await crawlCompany(fetcher, 'https://acme.example/');
    const result = await discoverHiringPages(fetcher, llm, crawlResult);

    expect(result.found).toBe(true);
    expect(result.hiringPages.map((p) => p.url)).toContain('https://acme.example/handbook/hiring/interviewing');
  });

  it('reports "not found" cleanly, without throwing, when nothing looks like a hiring page', async () => {
    const fetcher = new FakeFetchPort();
    fetcher.set(
      'https://acme.example/',
      page('https://acme.example/', '<a href="/login">Login</a><a href="/blog/2024/01/x">Blog</a>'),
    );
    fetcher.set(
      'https://acme.example/sitemap.xml',
      page('https://acme.example/sitemap.xml', '<urlset></urlset>'),
    );
    fetcher.set('https://acme.example/login', page('https://acme.example/login', '<p>Sign in</p>'));
    fetcher.set('https://acme.example/blog/2024/01/x', page('https://acme.example/blog/2024/01/x', '<p>A post.</p>'));

    const llm = new FakeLlmPort();
    llm.enqueue({ rankedIndices: [] });

    const crawlResult = await crawlCompany(fetcher, 'https://acme.example/');
    const result = await discoverHiringPages(fetcher, llm, crawlResult);

    expect(result.found).toBe(false);
    expect(result.hiringPages).toEqual([]);
  });

  it('records fetch failures in sourcesSkipped and continues rather than throwing', async () => {
    const fetcher = new FakeFetchPort();
    const crawlResult = {
      homepage: null,
      links: [{ url: 'https://acme.example/careers', anchorText: 'Careers' }],
      sourcesSkipped: [],
    };
    const llm = new FakeLlmPort();
    llm.enqueue({ rankedIndices: [] });

    const result = await discoverHiringPages(fetcher, llm, crawlResult);

    expect(result.found).toBe(false);
    expect(result.sourcesSkipped).toEqual([{ url: 'https://acme.example/careers', reason: 'network-error' }]);
  });
});
