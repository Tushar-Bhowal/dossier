import { describe, expect, it } from 'vitest';
import { extractLinks, htmlToText } from '@dossier/core';

describe('htmlToText', () => {
  it('strips scripts, styles and nav, keeping visible body text', () => {
    const html = `
      <html><head><style>.x{color:red}</style></head>
      <body>
        <nav><a href="/">Home</a></nav>
        <script>alert('hi')</script>
        <main>We are hiring engineers who care about craftsmanship.</main>
      </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('We are hiring engineers');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('Home');
  });

  it('strips elements hidden via the hidden attribute or an inline display:none style', () => {
    const html = `
      <div hidden>secret internal note</div>
      <div style="display:none">also hidden</div>
      <div>visible content</div>`;
    const text = htmlToText(html);
    expect(text).not.toContain('secret internal note');
    expect(text).not.toContain('also hidden');
    expect(text).toContain('visible content');
  });

  it('decodes common HTML entities', () => {
    expect(htmlToText('<p>Q&amp;A &mdash; caf&#39;e &lt;3</p>')).toContain("Q&A");
  });

  it('caps output length', () => {
    const html = `<p>${'a'.repeat(10_000)}</p>`;
    expect(htmlToText(html, 100)).toHaveLength(100);
  });
});

describe('extractLinks', () => {
  it('resolves relative links against the base URL', () => {
    const html = `
      <a href="/careers">Careers</a>
      <a href="../about">About</a>
      <a href="https://other.example/handbook">Handbook</a>`;
    const links = extractLinks(html, 'https://acme.example/company/team');
    expect(links).toContain('https://acme.example/careers');
    expect(links).toContain('https://acme.example/about');
    expect(links).toContain('https://other.example/handbook');
  });

  it('drops fragments, mailto/tel/javascript links and de-duplicates', () => {
    const html = `
      <a href="#top">Top</a>
      <a href="mailto:hi@acme.example">Email</a>
      <a href="tel:+15551234">Call</a>
      <a href="javascript:void(0)">JS</a>
      <a href="/careers">Careers</a>
      <a href="/careers#open-roles">Careers again</a>`;
    const links = extractLinks(html, 'https://acme.example/');
    expect(links).toEqual(['https://acme.example/careers']);
  });

  it('ignores unresolvable or non-http(s) hrefs', () => {
    const links = extractLinks('<a href="ftp://acme.example/file">FTP</a>', 'https://acme.example/');
    expect(links).toEqual([]);
  });
});
