import { describe, expect, it } from 'vitest';
import { scoreLink, rankLinks, type CrawlLink } from '@dossier/core';

function link(url: string, anchorText = '', depth = 1): CrawlLink {
  return { url, anchorText, depth };
}

describe('scoreLink', () => {
  it('scores a hiring-handbook page higher than a dated blog post for hiring intent', () => {
    const hiringPage = scoreLink(link('https://acme.example.com/handbook/hiring/interviewing', '', 2));
    const blogPost = scoreLink(link('https://acme.example.com/blog/2024/01/post', '', 3));
    expect(hiringPage).toBeGreaterThan(blogPost);
  });

  it('scores a careers page above a login page', () => {
    const careers = scoreLink(link('https://acme.example.com/careers'));
    const login = scoreLink(link('https://acme.example.com/login'));
    expect(careers).toBeGreaterThan(login);
  });

  it('scores an about page positively but below a stronger hiring-signal page', () => {
    const about = scoreLink(link('https://acme.example.com/about'));
    const hiring = scoreLink(link('https://acme.example.com/careers/hiring-process'));
    expect(about).toBeGreaterThan(0);
    expect(hiring).toBeGreaterThan(about);
  });

  it('penalises binary/document file extensions', () => {
    const pdf = scoreLink(link('https://acme.example.com/careers/handbook.pdf'));
    const page = scoreLink(link('https://acme.example.com/careers/handbook'));
    expect(pdf).toBeLessThan(page);
  });

  it('lets anchor text contribute signal even when the URL path itself has none', () => {
    const withSignal = scoreLink(link('https://acme.example.com/x1a2b3', 'Careers at Acme'));
    const withoutSignal = scoreLink(link('https://acme.example.com/x1a2b3', 'Read more'));
    expect(withSignal).toBeGreaterThan(withoutSignal);
  });

  it('applies a mild shallow-page preference as a tiebreaker only, not a dominant factor', () => {
    const deepWithSignal = scoreLink(link('https://acme.example.com/a/b/careers', '', 5));
    const shallowNoSignal = scoreLink(link('https://acme.example.com/x', '', 1));
    expect(deepWithSignal).toBeGreaterThan(shallowNoSignal);
  });
});

describe('rankLinks', () => {
  it('sorts links by score, descending', () => {
    const links = [
      link('https://acme.example.com/privacy'),
      link('https://acme.example.com/careers'),
      link('https://acme.example.com/about'),
    ];
    const ranked = rankLinks(links);
    expect(ranked.map((l) => l.url)).toEqual([
      'https://acme.example.com/careers',
      'https://acme.example.com/about',
      'https://acme.example.com/privacy',
    ]);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
    expect(ranked[1]!.score).toBeGreaterThan(ranked[2]!.score);
  });
});
