import { describe, expect, it } from 'vitest';
import { generateCompanyBrief } from '@dossier/core';
import { FakeLlmPort } from '../../fixtures/fakes/llm.js';

describe('generateCompanyBrief', () => {
  it('produces an honest, no-call brief when nothing was reachable', async () => {
    const llm = new FakeLlmPort();
    const brief = await generateCompanyBrief(llm, {
      companyUrl: 'https://unreachable.example',
      homepage: null,
      hiringPages: [],
      searchResults: [],
    });

    expect(brief.sources).toEqual([]);
    expect(brief.summary.toLowerCase()).toContain('unreachable.example');
    expect(brief.what_they_do.toLowerCase()).toContain('unknown');
    expect(llm.calls).toHaveLength(0);
  });

  it('populates sources only from real fetched URLs, never from the model output', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ summary: 'Acme is a small, fast-moving startup.', what_they_do: 'Acme builds developer tools.' });

    const brief = await generateCompanyBrief(llm, {
      companyUrl: 'https://acme.example',
      homepage: { url: 'https://acme.example/', text: 'Acme builds developer tools.' },
      hiringPages: [{ url: 'https://acme.example/careers', text: 'We are hiring.' }],
      searchResults: [{ title: 'Acme reviews', url: 'https://glassdoor.example/acme', snippet: 'good culture' }],
    });

    expect(brief.sources.sort()).toEqual(['https://acme.example/', 'https://acme.example/careers'].sort());
    expect(brief.summary).toBe('Acme is a small, fast-moving startup.');
    expect(brief.what_they_do).toBe('Acme builds developer tools.');
    expect(brief.origin).toBe('generated');
  });

  it('deduplicates sources when the homepage and a hiring page resolve to the same URL', async () => {
    const llm = new FakeLlmPort();
    llm.enqueue({ summary: 'summary', what_they_do: 'does things' });

    const brief = await generateCompanyBrief(llm, {
      companyUrl: 'https://acme.example',
      homepage: { url: 'https://acme.example/', text: 'text' },
      hiringPages: [{ url: 'https://acme.example/', text: 'text' }],
      searchResults: [],
    });

    expect(brief.sources).toEqual(['https://acme.example/']);
  });
});
