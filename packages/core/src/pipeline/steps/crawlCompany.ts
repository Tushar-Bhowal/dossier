import type { FetchPort } from '../../ports/fetcher.js';
import { FetchPortError } from '../../ports/fetcher.js';
import type { SourceSkipped } from '../../ports/runStore.js';
import { extractAnchors, htmlToText, type ExtractedLink } from '../../adapters/fetch/htmlToText.js';

export interface CrawledPage {
  url: string;
  text: string;
}

export interface CrawlCompanyResult {
  homepage: CrawledPage | null;
  // Same-origin links from the homepage and sitemap, with anchor text — ready for linkRanker.
  links: ExtractedLink[];
  sourcesSkipped: SourceSkipped[];
}

function skipReason(err: unknown): string {
  return err instanceof FetchPortError ? err.reason : 'unknown-error';
}

async function fetchSitemapLinks(fetcher: FetchPort, origin: string, sourcesSkipped: SourceSkipped[]): Promise<ExtractedLink[]> {
  const sitemapUrl = `${origin}/sitemap.xml`;
  try {
    const result = await fetcher.fetch(sitemapUrl);
    const locs = [...result.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.trim());
    return locs
      .filter((loc) => {
        try {
          return new URL(loc).origin === origin;
        } catch {
          return false;
        }
      })
      .map((url) => ({ url, anchorText: '' }));
  } catch (err) {
    sourcesSkipped.push({ url: sitemapUrl, reason: skipReason(err) });
    return [];
  }
}

// §2: homepage + sitemap.xml are the two cheapest high-yield sources of same-origin links. Every
// fetch failure is recorded and the crawl continues — an unreachable sitemap or a 404 homepage is a
// normal outcome here, never a thrown error.
export async function crawlCompany(fetcher: FetchPort, companyUrl: string): Promise<CrawlCompanyResult> {
  const sourcesSkipped: SourceSkipped[] = [];

  let origin: string;
  try {
    origin = new URL(companyUrl).origin;
  } catch {
    return { homepage: null, links: [], sourcesSkipped: [{ url: companyUrl, reason: 'invalid-url' }] };
  }

  let homepage: CrawledPage | null = null;
  let homepageLinks: ExtractedLink[] = [];
  try {
    const result = await fetcher.fetch(`${origin}/`);
    homepage = { url: result.finalUrl, text: htmlToText(result.text) };
    homepageLinks = extractAnchors(result.text, result.finalUrl).filter((link) => {
      try {
        return new URL(link.url).origin === origin;
      } catch {
        return false;
      }
    });
  } catch (err) {
    sourcesSkipped.push({ url: `${origin}/`, reason: skipReason(err) });
  }

  const sitemapLinks = await fetchSitemapLinks(fetcher, origin, sourcesSkipped);

  const seen = new Set<string>();
  const links: ExtractedLink[] = [];
  for (const link of [...homepageLinks, ...sitemapLinks]) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    links.push(link);
  }

  return { homepage, links, sourcesSkipped };
}
